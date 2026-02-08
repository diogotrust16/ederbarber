import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Logo from "@/components/Logo";
import ServiceCard from "@/components/ServiceCard";
import BottomNav from "@/components/BottomNav";
import BookingModal from "@/components/BookingModal";
import { useServices, Service } from "@/hooks/useServices";
import { toast } from "@/hooks/use-toast";

const Index = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"agendar" | "historico" | "planos">("agendar");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);

  const { data: services, isLoading: servicesLoading } = useServices();

  const handleServiceClick = (service: Service) => {
    setSelectedService(service);
    setIsBookingOpen(true);
  };

  const handleTabChange = (tab: "agendar" | "historico" | "planos") => {
    if (tab === "historico") {
      navigate("/historico");
      return;
    }
    if (tab === "planos") {
      navigate("/planos");
      return;
    }
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <Logo />

      <main className="container max-w-3xl mx-auto px-4">
        <div className="space-y-4">
          {servicesLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando serviços...
            </div>
          ) : (
            services?.map((service, index) => (
              <div
                key={service.id}
                className="animate-fade-in"
                style={{ animationDelay: `${index * 0.03}s` }}
              >
                <ServiceCard
                  name={service.name}
                  price={`R$ ${service.price.toFixed(2).replace(".", ",")}`}
                  duration={`${service.duration_minutes}min`}
                  description={service.description || undefined}
                  onClick={() => handleServiceClick(service)}
                />
              </div>
            ))
          )}
        </div>
      </main>

      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />

      <BookingModal
        service={selectedService}
        isOpen={isBookingOpen}
        onClose={() => {
          setIsBookingOpen(false);
          setSelectedService(null);
        }}
      />
    </div>
  );
};

export default Index;
