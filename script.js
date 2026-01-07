// ===== MOBILE MENU =====
const navMenu = document.getElementById('nav-menu');
const navToggle = document.getElementById('nav-toggle');
const navClose = document.getElementById('nav-close');
const navLinks = document.querySelectorAll('.nav__link');

// Show menu
if (navToggle) {
    navToggle.addEventListener('click', () => {
        navMenu.classList.add('show-menu');
    });
}

// Hide menu
if (navClose) {
    navClose.addEventListener('click', () => {
        navMenu.classList.remove('show-menu');
    });
}

// Hide menu when clicking on nav links
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('show-menu');
    });
});

// ===== HEADER SCROLL =====
function scrollHeader() {
    const header = document.getElementById('header');
    if (window.scrollY >= 50) {
        header.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
    } else {
        header.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
    }
}

window.addEventListener('scroll', scrollHeader);

// ===== ACTIVE LINK ON SCROLL =====
const sections = document.querySelectorAll('section[id]');

function scrollActive() {
    const scrollY = window.pageYOffset;

    sections.forEach(current => {
        const sectionHeight = current.offsetHeight;
        const sectionTop = current.offsetTop - 100;
        const sectionId = current.getAttribute('id');

        if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
            document.querySelector('.nav__link[href*=' + sectionId + ']')?.classList.add('active-link');
        } else {
            document.querySelector('.nav__link[href*=' + sectionId + ']')?.classList.remove('active-link');
        }
    });
}

window.addEventListener('scroll', scrollActive);

// ===== SMOOTH SCROLL =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        
        if (target) {
            const headerHeight = document.getElementById('header').offsetHeight;
            const targetPosition = target.offsetTop - headerHeight;
            
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// ===== FORM SUBMISSION =====
const contactForm = document.querySelector('.contact__form');

if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Get form values
        const formData = new FormData(contactForm);
        
        // Here you would typically send the data to a server
        // For now, we'll just show an alert
        alert('¡Gracias por tu mensaje! Nos pondremos en contacto contigo pronto.');
        
        // Reset form
        contactForm.reset();
    });
}

// ===== NEWSLETTER SUBSCRIPTION =====
const newsletterForm = document.querySelector('.footer__newsletter');

if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const emailInput = newsletterForm.querySelector('input[type="email"]');
        const email = emailInput.value;
        
        // Here you would typically send the email to a server
        // For now, we'll just show an alert
        if (email) {
            alert('¡Gracias por suscribirte a nuestro newsletter!');
            emailInput.value = '';
        }
    });
}

// ===== INTERSECTION OBSERVER FOR ANIMATIONS =====
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.animation = 'fadeInUp 0.8s ease forwards';
        }
    });
}, observerOptions);

// Observe all sections and cards
document.querySelectorAll('.section, .level-card, .project-card, .feature').forEach((el) => {
    observer.observe(el);
});

// ===== DYNAMIC YEAR FOR FOOTER =====
const footerCopy = document.querySelector('.footer__copy');
if (footerCopy) {
    const currentYear = new Date().getFullYear();
    footerCopy.innerHTML = `&copy; ${currentYear} Colegio Del Solar. Todos los derechos reservados.`;
}

// ===== SCROLL TO TOP FUNCTIONALITY =====
let scrollTopBtn = null;

function createScrollTopButton() {
    scrollTopBtn = document.createElement('button');
    scrollTopBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="18 15 12 9 6 15"></polyline>
        </svg>
    `;
    scrollTopBtn.className = 'scroll-top';
    scrollTopBtn.setAttribute('aria-label', 'Volver arriba');
    
    scrollTopBtn.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        width: 3rem;
        height: 3rem;
        background-color: var(--primary-color);
        color: white;
        border: none;
        border-radius: 50%;
        display: none;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transition: all 0.3s ease;
        z-index: 999;
    `;
    
    document.body.appendChild(scrollTopBtn);
    
    scrollTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

function toggleScrollTopButton() {
    if (!scrollTopBtn) return;
    
    if (window.scrollY > 500) {
        scrollTopBtn.style.display = 'flex';
    } else {
        scrollTopBtn.style.display = 'none';
    }
}

// Create scroll to top button
createScrollTopButton();
window.addEventListener('scroll', toggleScrollTopButton);

// ===== LOADING ANIMATION =====
window.addEventListener('load', () => {
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.5s ease';
        document.body.style.opacity = '1';
    }, 100);
});

// ===== TESTIMONIALS SLIDER =====
const testimonialsSlider = document.querySelector('.testimonials__slider');
const arrowLeft = document.querySelector('.testimonials__arrow--left');
const arrowRight = document.querySelector('.testimonials__arrow--right');

if (testimonialsSlider && arrowLeft && arrowRight) {
    let currentIndex = 0;
    const testimonialCards = document.querySelectorAll('.testimonial-card');
    const totalCards = testimonialCards.length;

    // Only show arrows if there are more cards than visible
    if (window.innerWidth > 968 && totalCards <= 3) {
        arrowLeft.style.display = 'none';
        arrowRight.style.display = 'none';
    }

    arrowRight.addEventListener('click', () => {
        if (currentIndex < totalCards - 3) {
            currentIndex++;
            updateSlider();
        }
    });

    arrowLeft.addEventListener('click', () => {
        if (currentIndex > 0) {
            currentIndex--;
            updateSlider();
        }
    });

    function updateSlider() {
        const cardWidth = testimonialCards[0].offsetWidth;
        const gap = 24; // var(--spacing-lg) in pixels
        const offset = -(currentIndex * (cardWidth + gap));
        testimonialsSlider.style.transform = `translateX(${offset}px)`;
        testimonialsSlider.style.transition = 'transform 0.5s ease';
    }
}

// ===== BLOG - GOOGLE SHEETS INTEGRATION =====
const GSHEET_ID = ''; // Ingresá aquí el ID de tu Google Sheet publicado como CSV

async function loadBlogPosts() {
    const blogContainer = document.getElementById('blog-container');
    const blogLoading = document.getElementById('blog-loading');
    const blogEmpty = document.getElementById('blog-empty');
    const blogError = document.getElementById('blog-error');
    
    if (!blogContainer) return;
    
    // Si no hay ID configurado, mostrar empty state
    if (!GSHEET_ID) {
        blogLoading.style.display = 'none';
        blogEmpty.style.display = 'flex';
        return;
    }
    
    try {
        // Mostrar loading
        blogLoading.style.display = 'flex';
        blogEmpty.style.display = 'none';
        blogError.style.display = 'none';
        
        // URL de la Google Sheet publicada como CSV
        // Formato: https://docs.google.com/spreadsheets/d/{GSHEET_ID}/export?format=csv&gid=0
        const csvUrl = `https://docs.google.com/spreadsheets/d/${GSHEET_ID}/export?format=csv&gid=0`;
        
        const response = await fetch(csvUrl);
        
        if (!response.ok) {
            throw new Error('Error al cargar los datos');
        }
        
        const csvText = await response.text();
        const posts = parseCSV(csvText);
        
        // Ocultar loading
        blogLoading.style.display = 'none';
        
        if (posts.length === 0) {
            blogEmpty.style.display = 'flex';
            return;
        }
        
        // Renderizar posts
        blogContainer.innerHTML = posts.map(post => createBlogPostHTML(post)).join('');
        
    } catch (error) {
        console.error('Error cargando blog posts:', error);
        blogLoading.style.display = 'none';
        blogError.style.display = 'flex';
    }
}

function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const posts = [];
    
    // Saltar la primera línea (encabezados)
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Parsear CSV respetando comas dentro de comillas
        const values = parseCSVLine(line);
        
        if (values.length >= 4) {
            posts.push({
                title: values[0] || 'Sin título',
                date: values[1] || '',
                image: values[2] || '',
                excerpt: values[3] || '',
                link: values[4] || '#'
            });
        }
    }
    
    return posts;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current.trim());
    return result;
}

function createBlogPostHTML(post) {
    const hasImage = post.image && post.image !== '';
    
    return `
        <article class="blog-post">
            <div class="blog-post__image">
                ${hasImage 
                    ? `<img src="${post.image}" alt="${post.title}" loading="lazy">` 
                    : `<div class="blog-post__placeholder">
                        <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                    </div>`
                }
            </div>
            <div class="blog-post__content">
                ${post.date ? `<span class="blog-post__date">${post.date}</span>` : ''}
                <h3 class="blog-post__title">${post.title}</h3>
                <p class="blog-post__excerpt">${post.excerpt}</p>
                <a href="${post.link}" class="blog-post__link" ${post.link !== '#' ? 'target="_blank" rel="noopener noreferrer"' : ''}>
                    Leer más →
                </a>
            </div>
        </article>
    `;
}

// Cargar blog posts cuando la página carga
window.addEventListener('load', () => {
    loadBlogPosts();
});

// ===== VIDEO CONTROLS =====
const playButtons = document.querySelectorAll('.play-button');
playButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        e.preventDefault();
        // Here you would implement video playback functionality
        alert('Funcionalidad de video - Aquí se reproducirá el testimonio en video');
    });
});

// ===== CONSOLE MESSAGE =====
console.log('%c🎓 Colegio Del Solar', 'color: #1a365d; font-size: 24px; font-weight: bold;');
console.log('%cSitio web desarrollado con HTML, CSS y JavaScript', 'color: #d4a574; font-size: 14px;');