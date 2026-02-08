import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface AdminSession {
  token: string;
  admin: {
    id: string;
    name: string;
    phone: string;
  };
  expiresAt: string;
}

export const useAdminSession = () => {
  const navigate = useNavigate();

  const getSession = useCallback((): AdminSession | null => {
    const sessionStr = localStorage.getItem("adminSession");
    if (!sessionStr) return null;
    
    try {
      const session = JSON.parse(sessionStr) as AdminSession;
      
      // Check if session is expired
      if (new Date(session.expiresAt) < new Date()) {
        localStorage.removeItem("adminSession");
        return null;
      }
      
      return session;
    } catch {
      localStorage.removeItem("adminSession");
      return null;
    }
  }, []);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const session = getSession();
    if (!session) return {};
    return { Authorization: `Bearer ${session.token}` };
  }, [getSession]);

  const invokeAdminFunction = useCallback(async (
    functionName: string,
    body: Record<string, unknown>
  ) => {
    const session = getSession();
    
    if (!session) {
      navigate("/admin/login");
      throw new Error("Sessão expirada");
    }

    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
      headers: { Authorization: `Bearer ${session.token}` },
    });

    if (error) {
      // Check if it's an auth error
      if (error.message?.includes("401") || error.message?.includes("Unauthorized")) {
        localStorage.removeItem("adminSession");
        toast({
          title: "Sessão expirada",
          description: "Por favor, faça login novamente",
          variant: "destructive",
        });
        navigate("/admin/login");
        throw new Error("Sessão expirada");
      }
      throw error;
    }

    // Check for auth errors in response
    if (data && !data.success && data.error?.includes("Sessão")) {
      localStorage.removeItem("adminSession");
      toast({
        title: "Sessão expirada",
        description: "Por favor, faça login novamente",
        variant: "destructive",
      });
      navigate("/admin/login");
      throw new Error(data.error);
    }

    return data;
  }, [getSession, navigate]);

  const logout = useCallback(() => {
    localStorage.removeItem("adminSession");
    navigate("/");
  }, [navigate]);

  const isAuthenticated = useCallback((): boolean => {
    return getSession() !== null;
  }, [getSession]);

  return {
    getSession,
    getAuthHeaders,
    invokeAdminFunction,
    logout,
    isAuthenticated,
  };
};
