import Navbar from '@/components/Navbar';
import HeroSlider from '@/components/HeroSlider';
import StatsBar from '@/components/StatsBar';
import AboutSection from '@/components/AboutSection';
import CareersSection from '@/components/CareersSection';
import HowWeWork from '@/components/HowWeWork';
import OurServices from '@/components/OurServices';
import GetInTouch from '@/components/GetInTouch';
import ClientsBar from '@/components/ClientsBar';
import Footer from '@/components/Footer';

const Index = () => {
  return (
    <div className="body-wrapper">
      <Navbar />
      <HeroSlider />
      <div className="our-company-financial overflow-hidden">
        <div className="overly"><div className="container"></div></div>
        <StatsBar />
        <AboutSection />
      </div>
      {/* Order matters: a visitor wants to know WHAT we do, then HOW we do it,
          before anything else. Careers sat above both, which pushed the
          services grid below the fold on most laptops. */}
      <OurServices />
      <HowWeWork />
      <CareersSection />
      <div className="can-help-overly-home overflow-hidden">
        <div className="can-help-overly"><div className="container"></div></div>
        <GetInTouch />
        <ClientsBar />
      </div>
      <Footer />
    </div>
  );
};

export default Index;
