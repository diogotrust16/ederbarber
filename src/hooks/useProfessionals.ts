import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Professional {
  id: string;
  name: string;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
}

export const useProfessionals = () => {
  return useQuery({
    queryKey: ["professionals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("*")
        .eq("is_active", true);

      if (error) throw error;
      return data as Professional[];
    },
  });
};
