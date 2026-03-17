import { useState, useEffect, useRef } from 'react';
import { FolderOpen, UserCheck, Coffee, Smile } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface StatItemProps {
  icon: LucideIcon;
  end: number;
  label: string;
}

const StatItem = ({ icon: Icon, end, label }: StatItemProps) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setStarted(true);
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    const duration = 2000;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [started, end]);

  return (
    <div ref={ref} className="flex flex-col items-center text-center px-8 border-r last:border-r-0 border-border">
      <Icon className="text-jobly-blue mb-4" size={32} />
      <span className="text-[36px] font-bold text-jobly-navy leading-none mb-2">{count}+</span>
      <span className="text-[14px] text-jobly-muted">{label}</span>
    </div>
  );
};

const StatsBar = () => {
  return (
    <div className="bg-jobly-stats-bg py-12 px-4 lg:px-[60px]">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
        <StatItem icon={FolderOpen} end={5620} label="Successful Project" />
        <StatItem icon={UserCheck} end={150} label="Expert Consulter" />
        <StatItem icon={Coffee} end={96} label="Cup Of Coffee" />
        <StatItem icon={Smile} end={3225} label="Client Satisfaction" />
      </div>
    </div>
  );
};

export default StatsBar;
