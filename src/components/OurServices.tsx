const services = [
  {
    img: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&q=80',
    title: 'Career Guidance',
    desc: "For all your career planning, please contact us. You won't be disappointed with the advice",
  },
  {
    img: 'https://images.unsplash.com/photo-1553028826-f4804a6dba3b?w=600&q=80',
    title: 'Staffing And Consulting',
    desc: 'Staffing and consulting services have a major role in the functioning of an organization',
  },
  {
    img: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&q=80',
    title: 'Software Training',
    desc: 'Jobly empowers you to take your talent far and wide, build a dedicated community',
  },
];

const OurServices = () => {
  return (
    <section className="py-20 px-4 lg:px-[60px] bg-jobly-light-bg">
      <div className="text-center mb-12">
        <div className="section-label justify-center">Jobly</div>
        <h2 className="text-[40px] font-bold text-jobly-navy">Our Services</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((s, i) => (
          <div
            key={i}
            className="bg-background rounded-lg overflow-hidden shadow-md hover:-translate-y-1.5 transition-transform duration-300"
          >
            <img src={s.img} className="w-full h-[220px] object-cover" alt={s.title} />
            <div className="p-6 relative">
              <h3 className="text-[18px] font-bold text-jobly-navy mb-3">{s.title}</h3>
              <p className="text-[14px] text-jobly-muted leading-[1.7] mb-8">{s.desc}</p>
              <div className="absolute bottom-6 right-6 bg-[hsl(0,86%,95%)] text-jobly-red border border-[hsl(354,71%,90%)] px-4 py-2 rounded text-[13px] font-semibold cursor-pointer flex items-center gap-2 hover:bg-jobly-red hover:text-primary-foreground transition-colors">
                Read More <span>→</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default OurServices;
