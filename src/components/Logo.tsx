import logoImage from "@/assets/logo-eder-barbearia.png";

const Logo = () => {
  return (
    <div className="flex justify-center py-8">
      <div className="w-44 h-44 rounded-full bg-black flex items-center justify-center shadow-lg overflow-hidden">
        <img 
          src={logoImage} 
          alt="Eder Barbearia" 
          className="w-36 h-36 object-contain"
        />
      </div>
    </div>
  );
};

export default Logo;
