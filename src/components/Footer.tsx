import { Facebook, Twitter, Instagram, Linkedin, MapPin, Phone, Mail } from 'lucide-react';
import footerLogo from '@/assets/footer-logo.png';

const Footer = () => {
  return (
    <footer className="bg-jobly-footer pt-16 text-primary-foreground">
      <div className="px-4 lg:px-[60px] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
        {/* Brand */}
        <div>
          <img src={footerLogo} alt="Jobly Solutions" className="h-12 mb-6 object-contain" />
          <p className="text-primary-foreground/60 text-[14px] leading-[1.8] mb-8">
            We genuinely have certainty that business elements develop and advance not just through the movement in their particular organizations additionally by designing a situation which consoles self-examination and enablement.
          </p>
          <div className="flex gap-3">
            {[Facebook, Twitter, Instagram, Linkedin].map((Icon, i) => (
              <div key={i} className="w-8 h-8 rounded-full border border-primary-foreground/20 flex items-center justify-center hover:bg-jobly-blue hover:border-jobly-blue transition-all cursor-pointer">
                <Icon size={14} />
              </div>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="text-[16px] font-semibold mb-2">Quick Links</h4>
          <div className="w-8 h-[2px] bg-jobly-blue mb-6" />
          <ul className="space-y-3">
            {['Home', 'About', 'Careers', 'Technology', 'Support'].map((link) => (
              <li key={link} className="text-primary-foreground/70 text-[14px] hover:text-primary-foreground hover:translate-x-1 transition-all cursor-pointer">
                <span className="text-jobly-blue mr-2">›</span> {link}
              </li>
            ))}
          </ul>
        </div>

        {/* Services */}
        <div>
          <h4 className="text-[16px] font-semibold mb-2">Services</h4>
          <div className="w-8 h-[2px] bg-jobly-blue mb-6" />
          <ul className="space-y-3">
            {['Career Guidance', 'Staffing And Consulting', 'Software Training'].map((link) => (
              <li key={link} className="text-primary-foreground/70 text-[14px] hover:text-primary-foreground hover:translate-x-1 transition-all cursor-pointer">
                <span className="text-jobly-blue mr-2">›</span> {link}
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="text-[16px] font-semibold mb-2">Contact</h4>
          <div className="w-8 h-[2px] bg-jobly-blue mb-6" />
          <div className="space-y-4 text-primary-foreground/70 text-[14px]">
            <div className="flex gap-3">
              <MapPin className="text-jobly-blue mt-1 shrink-0" size={16} />
              <span>110 Samaritan Dr Suite#211, Cumming, GA, 30040, USA</span>
            </div>
            <div className="flex gap-3">
              <Phone className="text-jobly-blue shrink-0" size={16} />
              <span>+1 404-863-5745</span>
            </div>
            <div className="flex gap-3">
              <Phone className="text-jobly-blue shrink-0" size={16} />
              <span>+1 470 660 5973</span>
            </div>
            <div className="flex gap-3">
              <Mail className="text-jobly-blue shrink-0" size={16} />
              <span>info@joblysolutions.com</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-jobly-footer-bottom px-4 lg:px-[60px] py-5 border-t border-primary-foreground/10 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-primary-foreground/50 text-[14px]">© 2022 Jobly | All Rights Reserved.</p>
        <div className="flex gap-6 text-primary-foreground/50 text-[14px]">
          <span className="hover:text-primary-foreground cursor-pointer">Terms & Conditions</span>
          <span className="hover:text-primary-foreground cursor-pointer">Privacy Policy</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
