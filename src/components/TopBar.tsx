import { Facebook, Twitter, Instagram, Linkedin, Phone, Mail } from 'lucide-react';

const TopBar = () => {
  return (
    <div className="bg-black h-[38px] items-center justify-between px-[60px] text-primary-foreground overflow-hidden hidden lg:flex">
      <div className="flex items-center gap-4">
        <span className="text-[13px]">Follow On:</span>
        <div className="flex items-center gap-3">
          <Facebook className="cursor-pointer hover:text-jobly-blue transition-colors" size={14} />
          <div className="bg-jobly-twitter p-[4px] rounded-[2px] cursor-pointer">
            <Twitter size={12} />
          </div>
          <Instagram className="cursor-pointer hover:text-jobly-blue transition-colors" size={14} />
          <Linkedin className="cursor-pointer hover:text-jobly-blue transition-colors" size={14} />
        </div>
      </div>
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2">
          <Phone className="text-jobly-blue" size={12} />
          <span className="text-[13px]">+1 404-863-5745</span>
        </div>
        <div className="w-[1px] h-4 bg-primary-foreground/30" />
        <div className="flex items-center gap-2">
          <Mail className="text-jobly-blue" size={12} />
          <span className="text-[13px]">info@joblysolutions.com</span>
        </div>
      </div>
    </div>
  );
};

export default TopBar;
