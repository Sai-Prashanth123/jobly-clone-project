import { Star } from 'lucide-react';

const AboutSection = () => {
  return (
    <section className="py-20 px-4 lg:px-[60px] bg-background">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="relative">
          <div className="absolute -z-10 top-0 left-0 w-64 h-64 bg-jobly-stats-bg rounded-full blur-3xl" />
          <div className="relative flex">
            <img
              src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&q=80"
              className="w-4/5 rounded-lg shadow-xl"
              alt="Team collaboration"
            />
            <div className="absolute -bottom-10 -right-4 w-1/2 bg-background p-4 rounded-lg shadow-2xl border border-border">
              <img
                src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&q=80"
                className="rounded"
                alt="Team success"
              />
            </div>
          </div>
        </div>

        <div>
          <div className="section-label">Jobly</div>
          <h2 className="text-[36px] font-bold text-jobly-navy mb-6">About Us</h2>
          <p className="text-[16px] text-jobly-muted leading-[1.8] mb-10">
            Jobly Solutions is a leading manpower consulting and recruitment company that offers top-notch staffing solutions to businesses across various industries. Our company was established in 2022 with a mission to connect the right talent with the right job, and we have been fulfilling this mission ever since.
          </p>

          <div className="flex flex-wrap gap-6">
            {[
              { label: 'SUCCESS PROJECT', val: '+95%' },
              { label: 'CUSTOMER REVIEW', val: '+4.7' },
            ].map((box) => (
              <div key={box.label} className="flex-1 min-w-[200px] border border-border p-6 rounded-lg">
                <span className="text-[11px] text-jobly-muted/70 block mb-1">{box.label}</span>
                <span className="text-[28px] font-bold text-jobly-navy block mb-2">{box.val}</span>
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="text-jobly-red" size={12} fill="currentColor" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
