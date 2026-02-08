import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "@/components/AdminSidebar";
import { useAdminSession } from "@/hooks/useAdminSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, Building2 } from "lucide-react";

interface DaySchedule {
  day_of_week: number;
  day_name: string;
  is_open: boolean;
  open_time: string;
  close_time: string;
}

const defaultSchedule: DaySchedule[] = [
  { day_of_week: 0, day_name: "Domingo", is_open: false, open_time: "09:00", close_time: "18:00" },
  { day_of_week: 1, day_name: "Segunda-feira", is_open: true, open_time: "09:00", close_time: "19:00" },
  { day_of_week: 2, day_name: "Terça-feira", is_open: true, open_time: "09:00", close_time: "19:00" },
  { day_of_week: 3, day_name: "Quarta-feira", is_open: true, open_time: "09:00", close_time: "19:00" },
  { day_of_week: 4, day_name: "Quinta-feira", is_open: true, open_time: "09:00", close_time: "19:00" },
  { day_of_week: 5, day_name: "Sexta-feira", is_open: true, open_time: "09:00", close_time: "19:00" },
  { day_of_week: 6, day_name: "Sábado", is_open: true, open_time: "09:00", close_time: "17:00" },
];

const AdminFuncionamento = () => {
  const navigate = useNavigate();
  const { isAuthenticated, invokeAdminFunction, logout } = useAdminSession();
  const [schedule, setSchedule] = useState<DaySchedule[]>(defaultSchedule);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/admin/login");
      return;
    }
    loadSchedule();
  }, [isAuthenticated, navigate]);

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const response = await invokeAdminFunction("admin-business-hours", {
        action: "list",
      });

      if (response.success && response.data && response.data.length > 0) {
        const merged = defaultSchedule.map((day) => {
          const found = response.data.find((d: any) => d.day_of_week === day.day_of_week);
          if (found) {
            return {
              ...day,
              is_open: found.is_open,
              open_time: found.open_time?.substring(0, 5) || day.open_time,
              close_time: found.close_time?.substring(0, 5) || day.close_time,
            };
          }
          return day;
        });
        setSchedule(merged);
      }
    } catch (error) {
      console.error("Error loading schedule:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDay = (dayOfWeek: number) => {
    setSchedule((prev) =>
      prev.map((day) =>
        day.day_of_week === dayOfWeek ? { ...day, is_open: !day.is_open } : day
      )
    );
  };

  const handleTimeChange = (dayOfWeek: number, field: "open_time" | "close_time", value: string) => {
    setSchedule((prev) =>
      prev.map((day) =>
        day.day_of_week === dayOfWeek ? { ...day, [field]: value } : day
      )
    );
  };

const persistSchedule = async () => {
  try {
    setSaving(true);
    const response = await invokeAdminFunction("admin-business-hours", {
      action: "upsert",
      schedule: schedule.map((day) => ({
          day_of_week: day.day_of_week,
          is_open: day.is_open,
          open_time: day.open_time,
          close_time: day.close_time,
        })),
      });

      if (response.success) {
        toast({
          title: "Sucesso",
          description: "Horários de funcionamento salvos com sucesso",
        });
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error("Error saving schedule:", error);
    toast({
      title: "Erro",
      description: "Não foi possível salvar os horários",
      variant: "destructive",
    });
  } finally {
    setSaving(false);
  }
};

const handleSave = () => {
  persistSchedule();
};

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  // Auto-save any change after initial load (debounced)
  useEffect(() => {
    if (loading) return;
    if (!hasLoadedOnce.current) {
      hasLoadedOnce.current = true;
      return;
    }
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      persistSchedule();
    }, 500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [schedule, loading]);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#0a1628]">
        <AdminSidebar onLogout={handleLogout} />
        <main className="flex-1 p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#00d9a5]" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#0a1628]">
      <AdminSidebar onLogout={handleLogout} />
      <main className="flex-1 w-full p-4 lg:p-6 pt-16 lg:pt-6 pb-16">
        <div className="max-w-3xl mx-auto w-full px-1 sm:px-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-[#00d9a5]" />
              <h1 className="text-2xl font-bold text-white">Horários de Funcionamento</h1>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto bg-[#00d9a5] hover:bg-[#00d9a5]/90 text-[#0a1628]"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </div>

          <Card className="bg-[#0d1f35] border-[#1a2d4a]">
            <CardHeader>
              <CardTitle className="text-white text-lg">
                Configure os horários de abertura e fechamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pb-6 sm:pb-4">
              {schedule.map((day) => (
                <div
                  key={day.day_of_week}
                  className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border transition-colors ${
                    day.is_open
                      ? "border-[#1a2d4a] bg-[#0a1628]"
                      : "border-[#1a2d4a]/50 bg-[#0a1628]/50"
                  }`}
                >
                  <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
                    <Switch
                      checked={day.is_open}
                      onCheckedChange={() => handleToggleDay(day.day_of_week)}
                    />
                    <Label
                      className={`font-medium ${
                        day.is_open ? "text-white" : "text-gray-500"
                      }`}
                    >
                      {day.day_name}
                    </Label>
                  </div>

                  {day.is_open && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 w-full">
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Label className="text-gray-400 text-sm">Abre</Label>
                        <Input
                          type="time"
                          value={day.open_time}
                          onChange={(e) =>
                            handleTimeChange(day.day_of_week, "open_time", e.target.value)
                          }
                          className="w-full sm:w-[130px] bg-[#0d1f35] border-[#1a2d4a] text-white"
                        />
                      </div>
                      <span className="hidden sm:inline text-gray-500">—</span>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Label className="text-gray-400 text-sm">Fecha</Label>
                        <Input
                          type="time"
                          value={day.close_time}
                          onChange={(e) =>
                            handleTimeChange(day.day_of_week, "close_time", e.target.value)
                          }
                          className="w-full sm:w-[130px] bg-[#0d1f35] border-[#1a2d4a] text-white"
                        />
                      </div>
                    </div>
                  )}

                  {!day.is_open && (
                    <span className="text-gray-500 text-sm italic">Fechado</span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AdminFuncionamento;
