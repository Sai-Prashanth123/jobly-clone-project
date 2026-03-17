import TopBar from '@/components/TopBar';
import Navbar from '@/components/Navbar';
import HeroSlider from '@/components/HeroSlider';
import StatsBar from '@/components/StatsBar';
import AboutSection from '@/components/AboutSection';
import CareersSection from '@/components/CareersSection';
import OurCompany from '@/components/OurCompany';
import OurServices from '@/components/OurServices';
import GetInTouch from '@/components/GetInTouch';
import ClientsBar from '@/components/ClientsBar';
import Footer from '@/components/Footer';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <Navbar />
      <main>
        <HeroSlider />
        <StatsBar />
        <AboutSection />
        <CareersSection />
        <OurCompany />
        <OurServices />
        <GetInTouch />
        <ClientsBar />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
