/* Theme detection now runs inline in <head> (index.html) so it applies
   before first paint — see the comment there for why it moved out of
   this deferred file. */

/* ───────────────────────────────────────────
   LOADING SCREEN
─────────────────────────────────────────── */
(function(){
  const screen = document.getElementById('loading-screen');
  const counter = document.getElementById('loading-counter');
  const bar = document.getElementById('loading-bar');
  const wordEl = document.getElementById('loading-word');
  const words = ['Design','Create','Inspire'];
  let wordIdx = 0, count = 0;
  const duration = 2700, start = performance.now();

  function cycleWord(){
    wordEl.classList.add('exit');
    setTimeout(() => {
      wordIdx = (wordIdx + 1) % words.length;
      wordEl.textContent = words[wordIdx];
      wordEl.classList.remove('exit');
      wordEl.classList.add('enter');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => wordEl.classList.remove('enter'));
      });
    }, 300);
  }
  const wordInterval = setInterval(cycleWord, 900);

  let finished = false;

  function finish(){
    if(finished) return;
    finished = true;
    clearInterval(wordInterval);
    clearTimeout(watchdog);
    setTimeout(() => {
      screen.classList.add('hide');
      setTimeout(() => { screen.style.display='none'; initPage(); }, 600);
    }, 400);
  }

  function tick(now){
    const elapsed = now - start;
    count = Math.min(100, Math.floor((elapsed / duration) * 100));
    counter.textContent = String(count).padStart(3,'0');
    bar.style.transform = `scaleX(${count/100})`;
    if(count < 100) requestAnimationFrame(tick);
    else finish();
  }

  // requestAnimationFrame pauses in background tabs, so guarantee completion
  const watchdog = setTimeout(finish, duration + 2000);
  requestAnimationFrame(tick);
})();

/* ───────────────────────────────────────────
   INIT after loading
─────────────────────────────────────────── */
function initPage(){
  initVideo();
  // Works/Journal inject real content into what were empty grid containers,
  // which changes the page's height. That MUST happen before initGSAP(),
  // because GSAP's ScrollTrigger measures scroll positions (like the
  // Explorations pin's "top top"/"bottom bottom") against the page height
  // at the moment it's set up. Previously initGSAP() ran first, so every
  // Explorations trigger was calculated against a shorter page — that's
  // what made the section start pinning/animating at the wrong scroll
  // offset (feeling like you "enter" it before it's actually ready).
  initWorks();
  initJournal();
  initLazyLoad();
  initGSAP();
  initRoles();
  initMarquee();
  initScrollReveal();
  initLightbox();
  initNavScroll();
  initNavLinks();
  initThemeToggle();
  initButtons();
}

/* ───────────────────────────────────────────
   HLS VIDEO
─────────────────────────────────────────── */
function loadHLS(videoEl, src){
  if(typeof Hls !== 'undefined' && Hls.isSupported()){
    const hls = new Hls({ maxBufferLength: 30, startFragPrefetch: true });
    hls.loadSource(src);
    hls.attachMedia(videoEl);
    hls.on(Hls.Events.ERROR, (_, data) => {
      if(data.fatal) console.warn('HLS fatal error:', data.type, data.details);
    });
  } else if(videoEl.canPlayType('application/vnd.apple.mpegurl')){
    videoEl.src = src;
  }
  const playPromise = videoEl.play();
  if(playPromise && playPromise.catch) playPromise.catch(()=>{});
}
function initVideo(){
  const src = 'https://stream.mux.com/Aa02T7oM1wH5Mk5EEVDYhbZ1ChcdhRsS2m1NYyx4Ua1g.m3u8';
  const hero = document.getElementById('hero-video');
  const footer = document.getElementById('footer-video');
  loadHLS(hero, src);
  // Footer video uses the same stream — defer it until it's near the viewport
  if('IntersectionObserver' in window && footer){
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if(e.isIntersecting){
          loadHLS(footer, src);
          obs.disconnect();
        }
      });
    }, { rootMargin:'600px 0px' });
    obs.observe(footer);
  } else if(footer){
    loadHLS(footer, src);
  }
}

/* ───────────────────────────────────────────
   LAZY-LOADED IMAGES
   Native `loading="lazy"` leaves the fetch-start distance up to the
   browser, which is often too small once a fast-scrolling / pinned
   section (like Explorations) is involved — the section becomes visible
   before the image has actually finished (or even started) downloading.
   This preloads images a good ~1200px BEFORE they reach the viewport, and
   fades them in once decoded, so nothing pops in empty mid-scroll.
─────────────────────────────────────────── */
function initLazyLoad(){
  const imgs = document.querySelectorAll('img[data-src]');
  if(!imgs.length) return;

  const loadImg = (img) => {
    const src = img.dataset.src;
    if(!src) return;
    delete img.dataset.src;
    img.addEventListener('load', () => img.classList.add('loaded'), { once:true });
    img.src = src;
    if(img.complete) img.classList.add('loaded');
  };

  if(!('IntersectionObserver' in window)){
    imgs.forEach(loadImg);
    return;
  }

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        loadImg(entry.target);
        obs.unobserve(entry.target);
      }
    });
  }, { rootMargin: '1200px 0px', threshold: 0 });

  imgs.forEach(img => obs.observe(img));
}

/* ───────────────────────────────────────────
   GSAP HERO ENTRANCE
─────────────────────────────────────────── */
function initGSAP(){
  if(typeof gsap === 'undefined'){
    // CDN unavailable — reveal hero content that CSS starts hidden
    document.querySelectorAll('.name-reveal, .blur-in').forEach(el => { el.style.opacity = 1; });
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  // Hero entrance
  const tl = gsap.timeline({ defaults:{ ease:'power3.out' } });
  tl.fromTo('.name-reveal', { opacity:0, y:50 }, { opacity:1, y:0, duration:1.2, delay:0.1 })
    .from('.blur-in', {
      opacity:0, filter:'blur(10px)', y:20, duration:1,
      stagger:0.1
    }, '-=0.8');

  // Exploration parallax
  const items = document.querySelectorAll('.explore-item');
  if(items.length){
    // Column 1 (odd items): scroll up
    const col1 = [items[0], items[2], items[4]];
    // Column 2 (even items): scroll down
    const col2 = [items[1], items[3], items[5]];

    col1.forEach((el, i) => {
      gsap.fromTo(el,
        { y: 80 + i * 20 },
        {
          y: -(80 + i * 20), ease:'none',
          scrollTrigger:{ trigger:'#explorations', start:'top bottom', end:'bottom top', scrub:true }
        }
      );
    });
    col2.forEach((el, i) => {
      gsap.fromTo(el,
        { y: -(60 + i * 20) },
        {
          y: 60 + i * 20, ease:'none',
          scrollTrigger:{ trigger:'#explorations', start:'top bottom', end:'bottom top', scrub:true }
        }
      );
    });

    // Pin center content while scrolling through section
    ScrollTrigger.create({
      trigger:'#explorations',
      start:'top top',
      end:'bottom bottom',
      pin:'#explore-pin',
      pinSpacing:false
    });
  }
}

/* Safety net: if web fonts finish swapping in, or any late-loading asset
   changes layout, after initGSAP() already measured the page, refresh
   ScrollTrigger so pin/parallax offsets stay correct instead of drifting. */
window.addEventListener('load', () => {
  if(typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
});
if(document.fonts && document.fonts.ready){
  document.fonts.ready.then(() => {
    if(typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
  }).catch(()=>{});
}

/* ───────────────────────────────────────────
   HERO — Role cycling
─────────────────────────────────────────── */
function initRoles(){
  const roles = ['Creative','Designer','Founder','Graduate'];
  let idx = 0;
  const el = document.getElementById('role-word');
  const id = setInterval(() => {
    el.style.animation = 'none';
    void el.offsetWidth;
    idx = (idx+1) % roles.length;
    el.textContent = roles[idx];
    el.style.animation = 'roleFadeIn 0.4s ease-out';
  }, 2000);
  // Cleanup on page unload to prevent memory leak
  window.addEventListener('beforeunload', () => clearInterval(id));
}

/* ───────────────────────────────────────────
   MARQUEE
─────────────────────────────────────────── */
function initMarquee(){
  if(typeof gsap === 'undefined') return;
  const track = document.getElementById('marquee-track');
  const text = 'BUILDING THE FUTURE • ';
  for(let i=0;i<6;i++){
    const span = document.createElement('span');
    span.className = 'marquee-text';
    span.textContent = text;
    track.appendChild(span);
  }
  gsap.to(track, {
    xPercent: -50, duration:40,
    ease:'none', repeat:-1
  });
}

/* ───────────────────────────────────────────
   SCROLL REVEAL (IntersectionObserver)
─────────────────────────────────────────── */
function initScrollReveal(){
  const els = document.querySelectorAll('.reveal');
  if(!('IntersectionObserver' in window)){
    els.forEach(el => el.classList.add('visible'));
    return;
  }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if(e.isIntersecting){
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { rootMargin:'-80px', threshold:0.1 });
  els.forEach(el => obs.observe(el));
}

/* ───────────────────────────────────────────
   LIGHTBOX
─────────────────────────────────────────── */
function initLightbox(){
  document.querySelectorAll('.explore-item').forEach(item => {
    item.addEventListener('click', () => {
      const src = item.dataset.img;
      const lightboxImg = document.getElementById('lightbox-img');
      lightboxImg.src = src;
      document.getElementById('lightbox').classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  });
  document.getElementById('lightbox').addEventListener('click', function(e){
    if(e.target === this) closeLightbox();
  });
  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
}
function closeLightbox(){
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if(e.key==='Escape') closeLightbox(); });

/* ───────────────────────────────────────────
   NAV SCROLL SHADOW
─────────────────────────────────────────── */
function initNavScroll(){
  const pill = document.getElementById('nav-pill');
  let ticking = false;
  window.addEventListener('scroll', () => {
    if(!ticking){
      requestAnimationFrame(() => {
        pill.classList.toggle('scrolled', window.scrollY > 100);
        ticking = false;
      });
      ticking = true;
    }
  }, { passive:true });
}

/* ───────────────────────────────────────────
   NAV ACTIVE LINKS (smooth scroll)
─────────────────────────────────────────── */
function initNavLinks(){
  const links = document.querySelectorAll('.nav-link');
  links.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = link.getAttribute('href');
      if(target && target.startsWith('#')){
        document.querySelector(target)?.scrollIntoView({ behavior:'smooth' });
      }
      links.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });

  // Update active on scroll
  const sections = ['hero','works','journal','explorations','stats','contact'];
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if(e.isIntersecting){
        const id = e.target.id;
        links.forEach(l => {
          const href = l.getAttribute('href');
          l.classList.toggle('active',
            href === '#'+id ||
            (id === 'journal' && href === '#works') ||
            (id === 'explorations' && href === '#works')
          );
        });
      }
    });
  }, { threshold:0.4 });
  sections.forEach(id => {
    const el = document.getElementById(id);
    if(el) obs.observe(el);
  });
}

function initThemeToggle(){
  const toggle = document.getElementById('theme-toggle');
  toggle.addEventListener('click', () => {
    const nextTheme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    try { localStorage.setItem('theme', nextTheme); } catch(e){}
  });
}

/* ───────────────────────────────────────────
   BUTTONS (data-scroll / data-alert)
─────────────────────────────────────────── */
function initButtons(){
  document.querySelectorAll('[data-scroll]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.scroll;
      if(target) document.getElementById(target)?.scrollIntoView({ behavior:'smooth' });
    });
  });
  document.querySelectorAll('[data-alert]').forEach(btn => {
    btn.addEventListener('click', () => alert(btn.dataset.alert));
  });
}

/* ───────────────────────────────────────────
   CONTENT — Works & Journal (data-driven)
─────────────────────────────────────────── */
const works = [
  { src: 'images/IMG_20220505_230456_Original.jpg', title: 'Automotive Motion' },
  { src: 'images/IMG_0554_Original.jpg', title: 'Urban Architecture' },
  { src: 'images/IMG_1523_Original.jpg', title: 'Human Perspective' },
  { src: 'images/IMG_2509_Original.jpg', title: 'Brand Identity' }
];

const journal = [
  { img: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=200&q=80', title: 'The nuance of micro-interactions in modern UI', meta: '5 min read · Jan 2026' },
  { img: 'https://images.unsplash.com/photo-1558655146-d09347e92766?w=200&q=80', title: 'Why restraint is the hardest design skill to master', meta: '7 min read · Dec 2025' },
  { img: 'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=200&q=80', title: 'Building for the next billion users', meta: '4 min read · Nov 2025' },
  { img: 'https://images.unsplash.com/photo-1547658719-da2b51169166?w=200&q=80', title: 'The invisible architecture of great products', meta: '6 min read · Oct 2025' }
];

function initWorks(){
  const grid = document.getElementById('works-grid');
  if(!grid) return;
  grid.innerHTML = works.map(w => `
    <div class="work-card reveal">
      <img class="lazy-img" data-src="${w.src}" alt="${w.title}" decoding="async" width="1600" height="1200"/>
      <div class="work-card-halftone"></div>
      <div class="work-card-hover">
        <div class="work-card-label">View — <em>${w.title}</em></div>
      </div>
    </div>
  `).join('');
}

function initJournal(){
  const list = document.getElementById('journal-list');
  if(!list) return;
  list.innerHTML = journal.map(j => `
    <div class="journal-item reveal">
      <img class="journal-img lazy-img" data-src="${j.img}" alt="" decoding="async" width="48" height="48"/>
      <div>
        <div class="journal-title">${j.title}</div>
        <div class="journal-meta">${j.meta}</div>
      </div>
      <span class="journal-arrow">↗</span>
    </div>
  `).join('');
}
