const StatsBar = () => (
  <div className="container">
    <div className="row mb-minus-30">
      {[
        { icon: 'icon-process-1', val: 5620, label: 'Successful Project' },
        { icon: 'icon-support-2', val: 150,  label: 'Expert Consulter' },
        { icon: 'icon-coffee-2',  val: 96,   label: 'Cup Of Cofee' },
        { icon: 'icon-teamwork-1',val: 3225, label: 'Client Satisfaction' },
      ].map((s, i) => (
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

export default StatsBar;
