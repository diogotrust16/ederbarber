interface ServiceCardProps {
  name: string;
  price: string;
  duration: string;
  description?: string;
  onClick?: () => void;
}
const ServiceCard = ({
  name,
  price,
  duration,
  description,
  onClick
}: ServiceCardProps) => {
  return <button onClick={onClick} className="service-card w-full text-center">
      <h3 className="font-medium text-foreground mb-2 text-base">
        {name}
      </h3>
      <p className="price-text font-medium text-sm text-sidebar-primary">
        {price} - {duration}
      </p>
      {description && <p className="text-muted-foreground text-sm mt-1">
          {description}
        </p>}
    </button>;
};
export default ServiceCard;