import { Phone, Mail } from 'lucide-react';

const GetInTouch = () => {
  return (
    <section className="bg-jobly-navy py-20 px-4 lg:px-[60px]">
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-16">
        <div className="text-primary-foreground">
          <h2 className="text-[36px] font-bold mb-6">Get In Touch</h2>
          <p className="text-primary-foreground/70 leading-[1.8] mb-12">
            We genuinely have certainty that business elements develop and advance not just through the movement in their particular organizations additionally by designing a situation which consoles self-examination and enablement.
          </p>

          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 bg-jobly-blue rounded-full flex items-center justify-center shrink-0">
                <Phone className="text-primary-foreground" size={18} />
              </div>
              <div>
                <p className="text-[12px] text-primary-foreground/60">Call Us</p>
                <p className="text-[18px] font-bold">+1 404-863-5745</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 bg-jobly-blue rounded-full flex items-center justify-center shrink-0">
                <Mail className="text-primary-foreground" size={18} />
              </div>
              <div>
                <p className="text-[12px] text-primary-foreground/60">Email Drop Us</p>
                <p className="text-[16px] font-bold">info@joblysolutions.com</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-background p-10 rounded-xl shadow-2xl">
          <div className="section-label">GET IN TOUCH</div>
          <h3 className="text-[26px] font-bold text-jobly-navy mb-8">Free Consultation</h3>
          <div className="space-y-4">
            <input type="text" placeholder="Full Name" className="w-full border border-border p-3 rounded focus:border-jobly-blue outline-none text-sm" />
            <input type="email" placeholder="Enter Email" className="w-full border border-border p-3 rounded focus:border-jobly-blue outline-none text-sm" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input type="text" placeholder="Phone No" className="w-full border border-border p-3 rounded focus:border-jobly-blue outline-none text-sm" />
              <input type="text" placeholder="Subject" className="w-full border border-border p-3 rounded focus:border-jobly-blue outline-none text-sm" />
            </div>
            <textarea placeholder="Message" className="w-full border border-border p-3 rounded h-24 focus:border-jobly-blue outline-none text-sm resize-none" />
            <div className="w-full bg-jobly-blue text-primary-foreground py-3.5 rounded font-semibold text-center cursor-pointer hover:brightness-90 transition-all">
              Send Your Message
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default GetInTouch;
