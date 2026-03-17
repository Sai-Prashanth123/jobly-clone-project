import { useState, useEffect } from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';

const Logo = () => (
  <div className="flex flex-col leading-none">
    <div className="flex items-center font-extrabold text-[28px] tracking-tight text-foreground">
      J
      <div className="relative mx-[1px] flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-[3px] border-foreground flex items-center justify-center p-1">
          <svg viewBox="0 0 24 24" className="w-full h-full text-jobly-blue" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </div>
        <div className="absolute -bottom-1 -right-1 w-3 h-[3px] bg-foreground rotate-45 rounded-full" />
      </div>
      bLY
    </div>
    <span className="text-jobly-blue text-[10px] font-bold tracking-[0.3em] mt-1">SOLUTIONS</span>
  </div>
);

const navItems = ['Home', 'About', 'Services', 'Careers', 'Technology', 'Clients', 'Contact'];
const servicesSub = ['Career Guidance Service', 'Staffing And Consulting Services', 'Software Training'];

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`sticky top-0 z-[1000] bg-background w-full transition-shadow duration-300 ${isScrolled ? 'shadow-lg' : ''}`}>
      <div className="px-4 lg:px-[60px] py-3 flex items-center justify-between">
        <Logo />

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-8">
          {navItems.map((item) =>
            item === 'Services' ? (
              <div key={item} className="group relative py-4">
                <div className="flex items-center gap-1 text-[15px] font-medium text-jobly-body hover:text-jobly-blue cursor-pointer transition-colors">
                  Services <ChevronDown size={10} />
                </div>
                <div className="absolute top-full left-0 w-[280px] bg-background shadow-xl rounded-lg opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200 border border-border">
                  {servicesSub.map((sub) => (
                    <div key={sub} className="px-5 py-3 text-[14px] text-jobly-body hover:bg-jobly-stats-bg hover:text-jobly-blue cursor-pointer transition-colors first:rounded-t-lg last:rounded-b-lg">
                      {sub}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div key={item} className="text-[15px] font-medium text-jobly-body hover:text-jobly-blue cursor-pointer transition-colors">
                {item}
              </div>
            )
          )}
        </div>

        {/* Mobile hamburger */}
        <div className="lg:hidden cursor-pointer" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden bg-background border-t border-border px-4 py-4 space-y-4">
          {navItems.map((item) => (
            <div key={item} className="text-[15px] font-medium text-jobly-body hover:text-jobly-blue cursor-pointer">
              {item}
            </div>
          ))}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
