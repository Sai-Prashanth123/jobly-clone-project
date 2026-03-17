import { Target, Eye, Diamond } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface CompanyCardProps {
  icon: LucideIcon;
  title: string;
  desc: string;
}

const CompanyCard = ({ icon: Icon, title, desc }: CompanyCardProps) => (
  <div className="bg-background border border-border rounded-xl p-8 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
    <div className="w-12 h-12 bg-jobly-blue rounded-full flex items-center justify-center mb-5">
      <Icon className="text-primary-foreground" size={22} />
    </div>
    <h3 className="text-[18px] font-bold text-jobly-navy mb-3">{title}</h3>
    <p className="text-[14px] text-jobly-muted leading-[1.7] mb-4">{desc}</p>
    <div className="text-jobly-blue text-[13px] font-medium flex items-center gap-1 cursor-pointer hover:gap-2 transition-all">
      Read More <span>›</span>
    </div>
  </div>
);

const OurCompany = () => {
  return (
    <section className="py-20 px-4 lg:px-[60px] bg-background">
      <div className="grid grid-cols-1 lg:grid-cols-[40%_60%] gap-12 items-start mb-12">
        <div>
          <div className="section-label">Jobly</div>
          <h2 className="text-[36px] font-bold text-jobly-navy mb-6">Our Company</h2>
          <div className="border-2 border-jobly-blue text-jobly-blue px-6 py-2.5 rounded inline-flex items-center gap-2 font-semibold cursor-pointer hover:bg-jobly-blue hover:text-primary-foreground transition-colors">
            Read More <span>→</span>
          </div>
        </div>
        <p className="text-[16px] text-jobly-muted leading-[1.8]">
          We genuinely have certainty that business elements develop and advance not just through the movement in their particular organizations additionally by designing a situation which consoles self-examination and enablement.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CompanyCard
          icon={Target}
          title="Mission"
          desc="Giving quality and beneficial programming answers for our predominant customers"
        />
        <CompanyCard
          icon={Eye}
          title="Vision"
          desc="Creating new milestones in knowledge and skill enhancement. Empowering higher education"
        />
        <CompanyCard
          icon={Diamond}
          title="Culture"
          desc="A certainty that our faculty discover work intriguing, duty to unwavering quality"
        />
      </div>
    </section>
  );
};

export default OurCompany;
