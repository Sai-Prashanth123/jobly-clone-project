const logos = [
  'Careers', 'Maven', 'Circle', 'Eventify', 'Elitronic', 'ARIA', 'TechFlow', 'DataSync', 'CloudNine',
];

const ClientsBar = () => {
  return (
    <section className="bg-background py-12 border-y border-border overflow-hidden">
      <div className="animate-marquee">
        {[...logos, ...logos].map((name, i) => (
          <div
            key={i}
            className="mx-10 text-jobly-muted/40 hover:text-jobly-navy font-bold text-[22px] tracking-wide transition-colors cursor-pointer select-none whitespace-nowrap"
          >
            {name}
          </div>
        ))}
      </div>
    </section>
  );
};

export default ClientsBar;
