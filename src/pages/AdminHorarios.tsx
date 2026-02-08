import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2, Clock, Calendar, RotateCcw, CalendarDays } from "lucide-react";
import AdminSidebar from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useAdminSession } from "@/hooks/useAdminSession";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Professional {
  id: string;
  name: string;
}

interface BlockedTime {
  id: string;
  professional_id: string;
  block_type: "recurring" | "specific";
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string;
  end_time: string;
  reason: string | null;
  is_active: boolean;
  professionals?: { name: string } | null;
}

const daysOfWeek = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
];

const AdminHorarios = () => {
  const { invokeAdminFunction, isAuthenticated, logout } = useAdminSession();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProfessionalFilter, setSelectedProfessionalFilter] = useState<string>("all");

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form states
  const [formProfessionalId, setFormProfessionalId] = useState("");
  const [formBlockType, setFormBlockType] = useState<"recurring" | "specific">("recurring");
  const [formSelectedDays, setFormSelectedDays] = useState<number[]>([1]);
  const [formSpecificDate, setFormSpecificDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("12:00");
  const [formReason, setFormReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      fetchData();
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch professionals
      const { data: profsData } = await supabase
        .from("professionals")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (profsData) {
        setProfessionals(profsData);
        if (profsData.length > 0 && !formProfessionalId) {
          setFormProfessionalId(profsData[0].id);
        }
      }

      // Fetch blocked times
      const result = await invokeAdminFunction("admin-blocked-times", { action: "list" });
      if (result.success) {
        setBlockedTimes(result.data || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formProfessionalId) {
      toast.error("Selecione um profissional");
      return;
    }

    if (formBlockType === "specific" && !formSpecificDate) {
      toast.error("Selecione uma data");
      return;
    }

    if (formBlockType === "recurring" && formSelectedDays.length === 0) {
      toast.error("Selecione pelo menos um dia da semana");
      return;
    }

    setIsSubmitting(true);
    try {
      if (formBlockType === "recurring") {
        let successCount = 0;
        
        for (const day of formSelectedDays) {
          const result = await invokeAdminFunction("admin-blocked-times", {
            action: "create",
            professional_id: formProfessionalId,
            block_type: formBlockType,
            day_of_week: day,
            specific_date: null,
            start_time: formStartTime,
            end_time: formEndTime,
            reason: formReason || null,
          });
          
          if (result.success) {
            successCount++;
          }
        }
        
        if (successCount === formSelectedDays.length) {
          toast.success(successCount === 1 ? "Bloqueio criado com sucesso" : `${successCount} bloqueios criados`);
        } else {
          toast.success(`${successCount} de ${formSelectedDays.length} bloqueios criados`);
        }
        setIsCreateModalOpen(false);
        resetForm();
        fetchData();
      } else {
        const result = await invokeAdminFunction("admin-blocked-times", {
          action: "create",
          professional_id: formProfessionalId,
          block_type: formBlockType,
          day_of_week: null,
          specific_date: formSpecificDate,
          start_time: formStartTime,
          end_time: formEndTime,
          reason: formReason || null,
        });

        if (result.success) {
          toast.success("Bloqueio criado com sucesso");
          setIsCreateModalOpen(false);
          resetForm();
          fetchData();
        } else {
          toast.error(result.error || "Erro ao criar bloqueio");
        }
      }
    } catch (error) {
      console.error("Error creating block:", error);
      toast.error("Erro ao criar bloqueio");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const result = await invokeAdminFunction("admin-blocked-times", {
        action: "delete",
        id,
      });

      if (result.success) {
        toast.success("Bloqueio excluído");
        fetchData();
      } else {
        toast.error(result.error || "Erro ao excluir bloqueio");
      }
    } catch (error) {
      console.error("Error deleting block:", error);
      toast.error("Erro ao excluir bloqueio");
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const resetForm = () => {
    setFormBlockType("recurring");
    setFormSelectedDays([1]);
    setFormSpecificDate("");
    setFormStartTime("09:00");
    setFormEndTime("12:00");
    setFormReason("");
  };

  const toggleDay = (dayValue: number) => {
    setFormSelectedDays(prev => 
      prev.includes(dayValue)
        ? prev.filter(d => d !== dayValue)
        : [...prev, dayValue].sort((a, b) => a - b)
    );
  };

  const toggleAllDays = () => {
    if (formSelectedDays.length === 7) {
      setFormSelectedDays([]);
    } else {
      setFormSelectedDays([0, 1, 2, 3, 4, 5, 6]);
    }
  };

  const filteredBlocks = selectedProfessionalFilter === "all"
    ? blockedTimes
    : blockedTimes.filter(b => b.professional_id === selectedProfessionalFilter);

  const recurringBlocks = filteredBlocks.filter(b => b.block_type === "recurring");
  const specificBlocks = filteredBlocks.filter(b => b.block_type === "specific");

  const formatTime = (time: string) => time.slice(0, 5);

  return (
    <div className="flex min-h-screen bg-[#0a1628]">
      <AdminSidebar onLogout={logout} />

      <main className="flex-1 p-4 lg:p-6 pt-16 lg:pt-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-[#00d9a5]" />
              <h1 className="text-2xl font-bold text-white">Horários Bloqueados</h1>
            </div>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-[#00d9a5] hover:bg-[#00d9a5]/90 text-[#0a1628]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Bloqueio
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-[#0d1f35] border border-[#1a2d4a] rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#6366f1]/20 flex items-center justify-center">
                  <RotateCcw className="h-5 w-5 text-[#6366f1]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{recurringBlocks.length}</p>
                  <p className="text-xs text-gray-400">Recorrentes</p>
                </div>
              </div>
            </div>
            <div className="bg-[#0d1f35] border border-[#1a2d4a] rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#f59e0b]/20 flex items-center justify-center">
                  <CalendarDays className="h-5 w-5 text-[#f59e0b]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{specificBlocks.length}</p>
                  <p className="text-xs text-gray-400">Específicos</p>
                </div>
              </div>
            </div>
            <div className="col-span-2 md:col-span-1 bg-[#0d1f35] border border-[#1a2d4a] rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#00d9a5]/20 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-[#00d9a5]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{filteredBlocks.length}</p>
                  <p className="text-xs text-gray-400">Total Bloqueios</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filter */}
          <div className="mb-6">
            <Select value={selectedProfessionalFilter} onValueChange={setSelectedProfessionalFilter}>
              <SelectTrigger className="w-full sm:w-[280px] bg-[#0d1f35] border-[#1a2d4a] text-white">
                <SelectValue placeholder="Filtrar por profissional" />
              </SelectTrigger>
              <SelectContent className="bg-[#0d1f35] border-[#1a2d4a]">
                <SelectItem value="all">Todos os profissionais</SelectItem>
                {professionals.map((prof) => (
                  <SelectItem key={prof.id} value={prof.id}>
                    {prof.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="h-8 w-8 border-2 border-[#00d9a5] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-400">Carregando bloqueios...</p>
            </div>
          ) : (
            <Tabs defaultValue="recurring" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-[#0d1f35] border border-[#1a2d4a] rounded-lg p-1 h-auto">
                <TabsTrigger 
                  value="recurring" 
                  className="flex items-center gap-2 py-2.5 rounded-md data-[state=active]:bg-[#6366f1] data-[state=active]:text-white"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span className="hidden sm:inline">Recorrentes</span>
                  <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">{recurringBlocks.length}</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="specific" 
                  className="flex items-center gap-2 py-2.5 rounded-md data-[state=active]:bg-[#f59e0b] data-[state=active]:text-black"
                >
                  <CalendarDays className="h-4 w-4" />
                  <span className="hidden sm:inline">Datas Específicas</span>
                  <span className="bg-black/20 text-xs px-2 py-0.5 rounded-full">{specificBlocks.length}</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="recurring" className="mt-6">
                {recurringBlocks.length === 0 ? (
                  <div className="bg-[#0d1f35] border border-[#1a2d4a] rounded-lg p-12 text-center">
                    <div className="h-16 w-16 rounded-lg bg-[#6366f1]/10 flex items-center justify-center mx-auto mb-4">
                      <RotateCcw className="h-8 w-8 text-[#6366f1]/50" />
                    </div>
                    <p className="text-lg font-medium text-white mb-2">Nenhum bloqueio recorrente</p>
                    <p className="text-sm text-gray-400 mb-6">Crie bloqueios que se repetem toda semana</p>
                    <Button
                      onClick={() => {
                        setFormBlockType("recurring");
                        setIsCreateModalOpen(true);
                      }}
                      variant="outline"
                      className="border-[#1a2d4a] text-[#6366f1] hover:bg-[#6366f1]/10"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Criar bloqueio recorrente
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recurringBlocks.map((block) => (
                      <div 
                        key={block.id} 
                        className="group bg-[#0d1f35] border border-[#1a2d4a] rounded-lg p-4 flex items-center justify-between transition-colors hover:border-[#6366f1]/50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-[#6366f1] flex items-center justify-center">
                            <Clock className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-white">
                              {daysOfWeek.find(d => d.value === block.day_of_week)?.label}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              <span className="bg-[#6366f1]/20 text-[#a5b4fc] px-2 py-0.5 rounded text-xs">
                                {formatTime(block.start_time)} - {formatTime(block.end_time)}
                              </span>
                              {block.reason && (
                                <span>• {block.reason}</span>
                              )}
                            </div>
                            <p className="text-xs text-[#00d9a5] mt-1">
                              {block.professionals?.name}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirmId(block.id)}
                          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="specific" className="mt-6">
                {specificBlocks.length === 0 ? (
                  <div className="bg-[#0d1f35] border border-[#1a2d4a] rounded-lg p-12 text-center">
                    <div className="h-16 w-16 rounded-lg bg-[#f59e0b]/10 flex items-center justify-center mx-auto mb-4">
                      <CalendarDays className="h-8 w-8 text-[#f59e0b]/50" />
                    </div>
                    <p className="text-lg font-medium text-white mb-2">Nenhum bloqueio específico</p>
                    <p className="text-sm text-gray-400 mb-6">Crie bloqueios para datas específicas</p>
                    <Button
                      onClick={() => {
                        setFormBlockType("specific");
                        setIsCreateModalOpen(true);
                      }}
                      variant="outline"
                      className="border-[#1a2d4a] text-[#f59e0b] hover:bg-[#f59e0b]/10"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Criar bloqueio específico
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {specificBlocks.map((block) => (
                      <div 
                        key={block.id} 
                        className="group bg-[#0d1f35] border border-[#1a2d4a] rounded-lg p-4 flex items-center justify-between transition-colors hover:border-[#f59e0b]/50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-[#f59e0b] flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-white">
                              {block.specific_date && format(new Date(block.specific_date + "T00:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              <span className="bg-[#f59e0b]/20 text-[#fcd34d] px-2 py-0.5 rounded text-xs">
                                {formatTime(block.start_time)} - {formatTime(block.end_time)}
                              </span>
                              {block.reason && (
                                <span>• {block.reason}</span>
                              )}
                            </div>
                            <p className="text-xs text-[#00d9a5] mt-1">
                              {block.professionals?.name}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirmId(block.id)}
                          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>

      {/* Create Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="bg-[#0d1f35] border-[#1a2d4a] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#00d9a5] flex items-center justify-center">
                <Plus className="h-4 w-4 text-[#0a1628]" />
              </div>
              Novo Bloqueio
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Professional */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400">Profissional</label>
              <Select value={formProfessionalId} onValueChange={setFormProfessionalId}>
                <SelectTrigger className="bg-[#0a1628] border-[#1a2d4a] text-white">
                  <SelectValue placeholder="Selecione o profissional" />
                </SelectTrigger>
                <SelectContent className="bg-[#0d1f35] border-[#1a2d4a]">
                  {professionals.map((prof) => (
                    <SelectItem key={prof.id} value={prof.id}>
                      {prof.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Block Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400">Tipo de Bloqueio</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormBlockType("recurring")}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                    formBlockType === "recurring"
                      ? "bg-[#6366f1]/20 border-[#6366f1] text-white"
                      : "bg-[#0a1628] border-[#1a2d4a] text-gray-400 hover:border-[#6366f1]/50"
                  }`}
                >
                  <RotateCcw className="h-4 w-4" />
                  <span className="text-sm font-medium">Recorrente</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormBlockType("specific")}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                    formBlockType === "specific"
                      ? "bg-[#f59e0b]/20 border-[#f59e0b] text-white"
                      : "bg-[#0a1628] border-[#1a2d4a] text-gray-400 hover:border-[#f59e0b]/50"
                  }`}
                >
                  <CalendarDays className="h-4 w-4" />
                  <span className="text-sm font-medium">Data Específica</span>
                </button>
              </div>
            </div>

            {/* Day of Week (for recurring) - Multi-select */}
            {formBlockType === "recurring" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">Dias da Semana</label>
                <div className="bg-[#0a1628] rounded-lg p-4 space-y-3 border border-[#1a2d4a]">
                  <div className="flex items-center space-x-3 pb-3 border-b border-[#1a2d4a]">
                    <Checkbox
                      id="all-days"
                      checked={formSelectedDays.length === 7}
                      onCheckedChange={toggleAllDays}
                      className="border-[#1a2d4a] data-[state=checked]:bg-[#00d9a5] data-[state=checked]:border-[#00d9a5]"
                    />
                    <label htmlFor="all-days" className="text-sm text-white cursor-pointer font-medium">
                      Selecionar todos
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {daysOfWeek.map((day) => (
                      <div 
                        key={day.value} 
                        className={`flex items-center space-x-3 p-2 rounded-lg transition-colors cursor-pointer ${
                          formSelectedDays.includes(day.value) ? "bg-[#6366f1]/10" : "hover:bg-[#1a2d4a]/50"
                        }`}
                        onClick={() => toggleDay(day.value)}
                      >
                        <Checkbox
                          id={`day-${day.value}`}
                          checked={formSelectedDays.includes(day.value)}
                          onCheckedChange={() => toggleDay(day.value)}
                          className="border-[#1a2d4a] data-[state=checked]:bg-[#6366f1] data-[state=checked]:border-[#6366f1]"
                        />
                        <label htmlFor={`day-${day.value}`} className="text-sm text-white cursor-pointer">
                          {day.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Specific Date */}
            {formBlockType === "specific" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">Data</label>
                <Input
                  type="date"
                  value={formSpecificDate}
                  onChange={(e) => setFormSpecificDate(e.target.value)}
                  min={format(new Date(), "yyyy-MM-dd")}
                  className="bg-[#0a1628] border-[#1a2d4a] text-white"
                />
              </div>
            )}

            {/* Time Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">Início</label>
                <Input
                  type="time"
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                  className="bg-[#0a1628] border-[#1a2d4a] text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">Fim</label>
                <Input
                  type="time"
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
                  className="bg-[#0a1628] border-[#1a2d4a] text-white"
                />
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400">Motivo (opcional)</label>
              <Input
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                placeholder="Ex: Almoço, Reunião, Folga..."
                className="bg-[#0a1628] border-[#1a2d4a] text-white placeholder:text-gray-500"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
              className="bg-transparent border-[#1a2d4a] text-white hover:bg-[#1a2d4a]/50"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isSubmitting}
              className="bg-[#00d9a5] hover:bg-[#00d9a5]/90 text-[#0a1628]"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-[#0a1628] border-t-transparent rounded-full animate-spin" />
                  Criando...
                </span>
              ) : (
                "Criar Bloqueio"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent className="bg-[#0d1f35] border-[#1a2d4a] text-white">
          <AlertDialogHeader>
            <div className="h-12 w-12 rounded-lg bg-red-500/20 flex items-center justify-center mx-auto mb-2">
              <Trash2 className="h-6 w-6 text-red-400" />
            </div>
            <AlertDialogTitle className="text-center text-lg">Excluir Bloqueio?</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-gray-400">
              Essa ação não pode ser desfeita. O horário ficará disponível para agendamentos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 mt-4">
            <AlertDialogCancel className="bg-transparent border-[#1a2d4a] text-white hover:bg-[#1a2d4a]/50">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Excluir Bloqueio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminHorarios;
