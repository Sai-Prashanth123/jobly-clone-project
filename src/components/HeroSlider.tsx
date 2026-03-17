import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const slides = [
  {
    image: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=1600&q=80',
    sub: 'Accelerate your Career Growth & Upskill Yourself',
    title: 'Software Training\nServices',
  },
  {
    image: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1600&q=80',
    sub: 'Jobly offers a comprehensive range of IT consulting and staffing services',
    title: 'Staffing And Consulting\nServices',
  },
  {
    image: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1600&q=80',
    sub: 'To help you focus on your dream career',
    title: 'Career Guidance\nServices',
  },
];

const HeroSlider = () => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const prev = () => setCurrent((c) => (c - 1 + slides.length) % slides.length);
  const next = () => setCurrent((c) => (c + 1) % slides.length);

  return (
    <section className="relative h-[90vh] w-full overflow-hidden bg-jobly-navy">
      {slides.map((slide, idx) => (
        <div
          key={idx}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${idx === current ? 'opacity-100' : 'opacity-0'}`}
        >
          <div className="absolute inset-0 bg-jobly-navy/70 z-10" />
          <img src={slide.image} className="w-full h-full object-cover" alt="" />

          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center px-4">
            <p className="text-primary-foreground/70 uppercase tracking-widest text-sm mb-6 max-w-2xl">
              {slide.sub}
            </p>
            <h1 className="text-primary-foreground text-4xl lg:text-[52px] font-bold leading-[1.2] whitespace-pre-line mb-10">
              {slide.title}
            </h1>
            <div className="bg-jobly-blue text-primary-foreground px-8 py-3.5 rounded-full font-semibold cursor-pointer hover:brightness-90 transition-all flex items-center gap-2">
              Read More <span>→</span>
            </div>
          </div>

          <div className="absolute top-10 right-10 lg:right-20 z-20 text-primary-foreground/[0.15] text-[80px] lg:text-[100px] font-extrabold select-none">
            0{idx + 1}
          </div>
        </div>
      ))}

      {/* Arrows */}
      <div
        onClick={prev}
        className="absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center cursor-pointer hover:bg-primary-foreground/30 transition-colors"
      >
        <ChevronLeft className="text-primary-foreground" size={20} />
      </div>
      <div
        onClick={next}
        className="absolute right-4 lg:right-8 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center cursor-pointer hover:bg-primary-foreground/30 transition-colors"
      >
        <ChevronRight className="text-primary-foreground" size={20} />
      </div>

      {/* Dots */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 flex gap-2">
        {slides.map((_, idx) => (
          <div
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`h-2.5 rounded-full cursor-pointer transition-all ${idx === current ? 'bg-primary-foreground w-6' : 'border border-primary-foreground w-2.5'}`}
          />
        ))}
      </div>
    </section>
  );
};

export default HeroSlider;
