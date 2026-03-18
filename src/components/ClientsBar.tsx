import { useEffect } from 'react';

const clientLogos = [
  '/assets/img/clients/client7.jpg',
  '/assets/img/clients/client7a.jpg',
  '/assets/img/clients/client7b.jpg',
  '/assets/img/clients/client7c.jpg',
  '/assets/img/clients/client7d.jpg',
  '/assets/img/clients/client7e.jpg',
  '/assets/img/clients/client7f.jpg',
  '/assets/img/clients/client7g.jpg',
  '/assets/img/clients/client7h.jpg',
];

// data-slick value — active.js calls .slick() with no args and reads this attribute
const slickConfig = JSON.stringify({
  dots: false,
  arrows: false,
  autoplay: true,
  slidesToShow: 6,
  infinite: true,
  slidesToScroll: 1,
  autoplaySpeed: 500,
  responsive: [
    { breakpoint: 1300, settings: { slidesToShow: 5 } },
    { breakpoint: 1200, settings: { slidesToShow: 4 } },
    { breakpoint: 992,  settings: { slidesToShow: 3 } },
    { breakpoint: 768,  settings: { slidesToShow: 2 } },
    { breakpoint: 481,  settings: { slidesToShow: 1 } },
  ],
});

const ClientsBar = () => {
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const tryInit = () => {
      const $ = (window as any).$;
      if (!$ || !$.fn?.slick) {
        timeoutId = setTimeout(tryInit, 50);
        return;
      }
      const $el = $('.client-brand__slider');
      // Skip if active.js already initialized it on initial page load
      if ($el.hasClass('slick-initialized')) return;
      $el.slick();
    };

    tryInit();

    return () => {
      clearTimeout(timeoutId);
      const $ = (window as any).$;
      if ($?.fn?.slick) {
        const $el = $('.client-brand__slider');
        if ($el.hasClass('slick-initialized')) $el.slick('unslick');
      }
    };
  }, []);

  return (
    <div className="client-brand pb-xs-80 pb-md-100 pb-sm-100 pb-lg-100 pb-105 overflow-hidden">
      <div className="container">
        <div className="row">
          <div className="col-12">
            <div className="client-brand__slider" data-slick={slickConfig}>
              {clientLogos.map((src, i) => (
                <div key={i} className="slider-item">
                  <a href="#" className="client-brand__item">
                    <div className="client-brand__item-media">
                      <img src={src} className="img-fluid" alt={`Client ${i + 1}`} />
                    </div>
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientsBar;
