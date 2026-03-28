import { useCounterUp } from '@/hooks/useCounterUp';

const stats = [
  { icon: 'fas fa-chart-bar',  val: 5620, label: 'Successful Project'  },
  { icon: 'fas fa-headset',    val: 150,  label: 'Expert Consulter'    },
  { icon: 'fas fa-coffee',     val: 96,   label: 'Cup Of Cofee'        },
  { icon: 'fas fa-users',      val: 3225, label: 'Client Satisfaction' },
];

const StatsBar = () => {
  useCounterUp();
  return (
    <div className="container">
      <div className="row mb-minus-30">
        {stats.map((s, i) => (
          <div key={i} className="col-xl-3 col-lg-4 col-sm-6">
            <div className="counter-area__item d-flex align-items-center">
              <div className="icon color-primary">
                <i className={s.icon}></i>
              </div>
              <div className="text text-center">
                <div className="number fw-600 color-primary">
                  <span className="counter">{s.val}</span>+
                </div>
                <div className="description font-la">{s.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatsBar;
