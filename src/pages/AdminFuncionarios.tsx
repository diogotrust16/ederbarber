import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "@/components/AdminSidebar";
import { useAdminSession } from "@/hooks/useAdminSession";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, User, Upload, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Professional {
  id: string;
  name: string;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
}

interface ProfessionalFormData {
  name: string;
  avatar_url: string;
}

const AdminFuncionarios = () => {
  const navigate = useNavigate();
  const { isAuthenticated, invokeAdminFunction, logout } = useAdminSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [formData, setFormData] = useState<ProfessionalFormData>({
    name: "",
    avatar_url: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/admin/login");
      return;
    }
    fetchProfessionals();
  }, []);

  const fetchProfessionals = async () => {
    try {
      setLoading(true);
      const data = await invokeAdminFunction("admin-professionals", {
        action: "list",
      });
      setProfessionals(data.professionals || []);
    } catch (error) {
      console.error("Erro ao buscar funcionários:", error);
      toast.error("Erro ao carregar funcionários");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const openCreateModal = () => {
    setSelectedProfessional(null);
    setFormData({ name: "", avatar_url: "" });
    setPreviewImage(null);
    setModalOpen(true);
  };

  const openEditModal = (professional: Professional) => {
    setSelectedProfessional(professional);
    setFormData({
      name: professional.name,
      avatar_url: professional.avatar_url || "",
    });
    setPreviewImage(professional.avatar_url);
    setModalOpen(true);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
      return;
    }

    try {
      setUploadingImage(true);

      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from("professional-avatars")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("professional-avatars")
        .getPublicUrl(data.path);

      setFormData({ ...formData, avatar_url: urlData.publicUrl });
      setPreviewImage(urlData.publicUrl);
      toast.success("Imagem carregada com sucesso");
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao fazer upload da imagem");
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = () => {
    setFormData({ ...formData, avatar_url: "" });
    setPreviewImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    try {
      setSubmitting(true);

      if (selectedProfessional) {
        await invokeAdminFunction("admin-professionals", {
          action: "update",
          professional: {
            id: selectedProfessional.id,
            ...formData,
          },
        });
        toast.success("Funcionário atualizado com sucesso");
      } else {
        await invokeAdminFunction("admin-professionals", {
          action: "create",
          professional: formData,
        });
        toast.success("Funcionário criado com sucesso");
      }

      setModalOpen(false);
      fetchProfessionals();
    } catch (error) {
      console.error("Erro ao salvar funcionário:", error);
      toast.error("Erro ao salvar funcionário");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (professional: Professional) => {
    try {
      await invokeAdminFunction("admin-professionals", {
        action: "toggle",
        professional: { id: professional.id },
      });
      toast.success(
        professional.is_active
          ? "Funcionário desativado"
          : "Funcionário ativado"
      );
      fetchProfessionals();
    } catch (error) {
      console.error("Erro ao alterar status:", error);
      toast.error("Erro ao alterar status do funcionário");
    }
  };

  const handleDelete = async () => {
    if (!selectedProfessional) return;

    try {
      await invokeAdminFunction("admin-professionals", {
        action: "delete",
        professional: { id: selectedProfessional.id },
      });
      toast.success("Funcionário excluído com sucesso");
      setDeleteDialogOpen(false);
      setSelectedProfessional(null);
      fetchProfessionals();
    } catch (error) {
      console.error("Erro ao excluir funcionário:", error);
      toast.error("Erro ao excluir funcionário");
    }
  };

  const openDeleteDialog = (professional: Professional) => {
    setSelectedProfessional(professional);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0d1f38] flex">
      <AdminSidebar onLogout={handleLogout} />

      <main className="flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white">Funcionários</h1>
              <p className="text-[#00d9a5]/70 mt-1">
                Gerencie os profissionais da barbearia
              </p>
            </div>
            <Button
              onClick={openCreateModal}
              className="bg-[#00d9a5] hover:bg-[#00d9a5]/80 text-[#0a1628]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Funcionário
            </Button>
          </div>

          {/* Professional List */}
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="bg-[#0a1628] border-[#1a2d4a] p-6">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-16 w-16 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : professionals.length === 0 ? (
            <Card className="bg-[#0a1628] border-[#1a2d4a] p-12 text-center">
              <User className="h-16 w-16 text-[#00d9a5]/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                Nenhum funcionário cadastrado
              </h3>
              <p className="text-[#00d9a5]/60 mb-6">
                Adicione seu primeiro funcionário para começar
              </p>
              <Button
                onClick={openCreateModal}
                className="bg-[#00d9a5] hover:bg-[#00d9a5]/80 text-[#0a1628]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Funcionário
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {professionals.map((professional) => (
                <Card
                  key={professional.id}
                  className="bg-[#0a1628] border-[#1a2d4a] p-6"
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="relative">
                      {professional.avatar_url ? (
                        <img
                          src={professional.avatar_url}
                          alt={professional.name}
                          className="h-16 w-16 rounded-full object-cover border-2 border-[#00d9a5]/30"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-full bg-[#1a2d4a] flex items-center justify-center border-2 border-[#00d9a5]/30">
                          <User className="h-8 w-8 text-[#00d9a5]/50" />
                        </div>
                      )}
                      <div
                        className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-[#0a1628] ${
                          professional.is_active
                            ? "bg-green-500"
                            : "bg-gray-500"
                        }`}
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white truncate">
                        {professional.name}
                      </h3>
                      <p
                        className={`text-sm ${
                          professional.is_active
                            ? "text-green-400"
                            : "text-gray-400"
                        }`}
                      >
                        {professional.is_active ? "Ativo" : "Inativo"}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#1a2d4a]">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={professional.is_active}
                        onCheckedChange={() => handleToggleActive(professional)}
                      />
                      <span className="text-sm text-[#00d9a5]/60">
                        {professional.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditModal(professional)}
                        className="text-[#00d9a5] hover:bg-[#00d9a5]/10"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(professional)}
                        className="text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#0a1628] border-[#1a2d4a] text-white">
          <DialogHeader>
            <DialogTitle>
              {selectedProfessional ? "Editar Funcionário" : "Novo Funcionário"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Nome do funcionário"
                className="bg-[#0d1f38] border-[#1a2d4a] text-white"
              />
            </div>
            <div className="space-y-2">
              <Label>Foto</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {previewImage ? (
                <div className="relative inline-block">
                  <img
                    src={previewImage}
                    alt="Preview"
                    className="h-24 w-24 rounded-full object-cover border-2 border-[#00d9a5]/30"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={removeImage}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="border-[#1a2d4a] text-white hover:bg-[#1a2d4a] w-full"
                >
                  {uploadingImage ? (
                    "Carregando..."
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Selecionar Foto
                    </>
                  )}
                </Button>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="border-[#1a2d4a] text-white hover:bg-[#1a2d4a]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-[#00d9a5] hover:bg-[#00d9a5]/80 text-[#0a1628]"
              >
                {submitting ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#0a1628] border-[#1a2d4a]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Excluir Funcionário
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#00d9a5]/70">
              Tem certeza que deseja excluir "{selectedProfessional?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#1a2d4a] text-white hover:bg-[#1a2d4a]">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminFuncionarios;
