import { useEffect } from 'react';
import { Link } from 'react-router-dom';

const slides = [
  {
    image: '/assets/img/banner/banne-slider-1a.png',
    num: '01',
    sub: 'Accelerate your',
    subSpan: 'Career Growth & Upskill Yourself',
    title: 'Software Training <br/> Services',
    href: '/software-training',
  },
  {
    image: '/assets/img/banner/banne-slider-1b.png',
    num: '02',
    sub: 'Jobly offers a comprehensive range of',
    subSpan: 'IT consulting and staffing services',
    title: 'Staffing And Consulting Services',
    href: '/staffing-and-consulting',
  },
  {
    image: '/assets/img/banner/banne-slider-1c.png',
    num: '03',
    sub: 'To help you focus on',
    subSpan: 'your dream career',
    title: 'Career Guidance<br/> Services',
    href: '/career-guidance',
  },
];

const HeroSlider = () => {
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const tryInit = () => {
      const $ = (window as any).$;
      if (!$ || !$.fn?.slick) {
        timeoutId = setTimeout(tryInit, 50);
        return;
      }
      const $el = $('.banner-slider');
      if ($el.hasClass('slick-initialized')) return;
      $el.slick({
        dots: true,
        arrows: true,
        autoplay: true,
        slidesToShow: 1,
        infinite: true,
        slidesToScroll: 1,
        autoplaySpeed: 1500,
        appendArrows: $('.slider-controls .banner-slider-arrows'),
        prevArrow: "<button type='button' class='slick-prev pull-left'><i class='fas fa-long-arrow-alt-left' aria-hidden='true'></i></button>",
        nextArrow: "<button type='button' class='slick-next pull-right'><i class='fas fa-long-arrow-alt-right' aria-hidden='true'></i></button>",
      });
    };

    tryInit();

    return () => {
      clearTimeout(timeoutId);
      const $ = (window as any).$;
      if ($?.fn?.slick) {
        const $el = $('.banner-slider');
        if ($el.hasClass('slick-initialized')) $el.slick('unslick');
      }
    };
  }, []);

  return (
    <section className="banner-slider__wrapper pt-0 pb-0 overflow-hidden">
      <div className="slider-controls">
        <div className="banner-slider-arrows d-flex flex-column"></div>
      </div>

      <div className="banner-slider overflow-hidden">
        {slides.map((slide, idx) => (
          <div
            key={idx}
            className="slider-item"
            style={{ backgroundImage: `url(${slide.image})` }}
          >
            <div className="number" data-animation="fadeInUp" data-delay="0.6s">
              {slide.num}
            </div>
            <div className="container">
              <div className="row">
                <div className="col-12">
                  <div className="banner__content text-center">
                    <h6
                      className="sub-title color-white mb-15 mb-sm-15 mb-xs-10"
                      data-animation="fadeInUp"
                      data-delay="0.5s"
                    >
                      {slide.sub} <span>{slide.subSpan}</span>
                    </h6>
                    <h1
                      className="title color-white mb-sm-30 mb-xs-20 mb-40"
                      data-animation="fadeInUp"
                      data-delay="1s"
                      dangerouslySetInnerHTML={{ __html: slide.title }}
                    />
                    <div className="theme-btn__wrapper d-flex justify-content-center">
                      <Link to={slide.href} className="theme-btn btn-sm">
                        Read More <i className="fas fa-long-arrow-alt-right"></i>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default HeroSlider;
