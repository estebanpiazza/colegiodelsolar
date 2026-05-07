const header = document.getElementById('header')
const navMenu = document.getElementById('nav-menu')
const navToggle = document.getElementById('nav-toggle')
const navClose = document.getElementById('nav-close')
const navLinks = Array.from(document.querySelectorAll('.nav__link[href^="#"]'))
const sections = Array.from(document.querySelectorAll('section[id]')).filter((section) => !section.hidden)
const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
const mobileQuery = window.matchMedia('(max-width: 768px)')
const navBreakpointQuery = window.matchMedia('(max-width: 980px)')
const pageLang = document.documentElement.lang.toLowerCase().startsWith('en') ? 'en' : 'es'

const i18n = {
    es: {
        contactSent: 'Mensaje enviado. Te responderemos a la brevedad.',
        contactSending: 'Enviando tu mensaje...',
        contactSendingButton: 'Enviando...',
        contactSubmitButton: 'Enviar mensaje',
        contactError: 'No pudimos enviar el mensaje. Intenta nuevamente en unos minutos.',
        footerCopy: (year) => `\u00A9 ${year} Colegio Del Solar. Todos los derechos reservados.`
    },
    en: {
        contactSent: 'Message sent. We will get back to you shortly.',
        contactSending: 'Sending your message...',
        contactSendingButton: 'Sending...',
        contactSubmitButton: 'Send message',
        contactError: 'We could not send your message. Please try again in a few minutes.',
        footerCopy: (year) => `\u00A9 ${year} Colegio Del Solar. All rights reserved.`
    }
}

const t = i18n[pageLang]

function bindMediaChange(mediaQuery, handler) {
    if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', handler)
        return
    }

    if (typeof mediaQuery.addListener === 'function') {
        mediaQuery.addListener(handler)
    }
}

function prefersReducedMotion() {
    return reduceMotionQuery.matches
}

function isSmallScreen() {
    return mobileQuery.matches
}

function setMenuState(isOpen) {
    if (!navMenu) return

    navMenu.classList.toggle('show-menu', isOpen)
    navMenu.setAttribute('aria-hidden', String(!isOpen))
    document.body.classList.toggle('menu-open', isOpen)

    if (navToggle) {
        navToggle.setAttribute('aria-expanded', String(isOpen))
    }
}

if (navMenu) {
    navMenu.setAttribute('aria-hidden', 'true')
}

if (navToggle) {
    navToggle.setAttribute('aria-expanded', 'false')
    navToggle.addEventListener('click', () => setMenuState(true))
}

if (navClose) {
    navClose.addEventListener('click', () => setMenuState(false))
}

navLinks.forEach((link) => {
    link.addEventListener('click', () => setMenuState(false))
})

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        setMenuState(false)
    }
})

bindMediaChange(navBreakpointQuery, (event) => {
    if (!event.matches) {
        setMenuState(false)
    }
})

function updateHeaderState() {
    if (!header) return
    header.classList.toggle('scrolled', window.scrollY >= 20)
}

function updateActiveLink() {
    if (!navLinks.length) return

    const currentPosition = window.scrollY + (header?.offsetHeight || 0) + 120
    let activeId = sections[0]?.id || ''

    sections.forEach((section) => {
        if (currentPosition >= section.offsetTop) {
            activeId = section.id
        }
    })

    navLinks.forEach((link) => {
        const targetId = link.getAttribute('href')?.slice(1) || ''
        link.classList.toggle('active-link', targetId === activeId)
    })
}

let scrollTicking = false

const scrollTopButton = document.getElementById('scroll-top')

function updateScrollTopButton() {
    if (!scrollTopButton) return
    const triggerOffset = isSmallScreen() ? 760 : 400
    scrollTopButton.classList.toggle('is-visible', window.scrollY > triggerOffset)
}

if (scrollTopButton) {
    scrollTopButton.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    })
}

function syncOnScroll() {
    if (scrollTicking) return

    scrollTicking = true
    window.requestAnimationFrame(() => {
        updateHeaderState()
        updateActiveLink()
        updateScrollTopButton()
        scrollTicking = false
    })
}

window.addEventListener('scroll', syncOnScroll, { passive: true })
updateHeaderState()
updateActiveLink()

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    const targetSelector = anchor.getAttribute('href')

    if (!targetSelector || targetSelector === '#') return

    anchor.addEventListener('click', (event) => {
        const target = document.querySelector(targetSelector)
        if (!target) return

        event.preventDefault()

        const headerOffset = header?.offsetHeight || 0
        const top = target.getBoundingClientRect().top + window.scrollY - headerOffset - 12

        window.scrollTo({
            top,
            behavior: prefersReducedMotion() ? 'auto' : 'smooth'
        })
    })
})

const contactForm = document.querySelector('.contact__form')

if (contactForm) {
    const contactStatus = contactForm.querySelector('.form__status')
    const contactSubmitButton = contactForm.querySelector('button[type="submit"]')
    const contactSubmitText = contactForm.querySelector('.contact__submit-text')

    const setContactStatus = (message, state = '') => {
        if (!contactStatus) return

        contactStatus.textContent = message
        contactStatus.classList.remove('is-loading', 'is-success', 'is-error')

        if (state) {
            contactStatus.classList.add(`is-${state}`)
        }
    }

    contactForm.addEventListener('submit', async (event) => {
        event.preventDefault()

        if (!contactForm.reportValidity()) {
            return
        }

        const formData = new FormData(contactForm)
        const honeypot = String(formData.get('_honey') || '').trim()

        if (honeypot) {
            contactForm.reset()
            setContactStatus(t.contactSent, 'success')
            return
        }

        formData.set('_url', window.location.href)

        if (contactSubmitButton) {
            contactSubmitButton.disabled = true
        }

        if (contactSubmitText) {
            contactSubmitText.textContent = t.contactSendingButton
        }

        contactForm.setAttribute('aria-busy', 'true')
        setContactStatus(t.contactSending, 'loading')

        try {
            const response = await fetch(contactForm.action, {
                method: contactForm.method,
                body: formData,
                headers: {
                    Accept: 'application/json'
                }
            })

            const data = await response.json().catch(() => null)

            const submissionFailed = data?.success === false || data?.success === 'false'

            if (!response.ok || submissionFailed) {
                throw new Error(data?.message || t.contactError)
            }

            contactForm.reset()
            setContactStatus(t.contactSent, 'success')
        } catch (error) {
            setContactStatus(
                error?.message || t.contactError,
                'error'
            )
        } finally {
            contactForm.removeAttribute('aria-busy')

            if (contactSubmitButton) {
                contactSubmitButton.disabled = false
            }

            if (contactSubmitText) {
                contactSubmitText.textContent = t.contactSubmitButton
            }
        }
    })
}

const revealElements = Array.from(document.querySelectorAll('[data-reveal]'))
let revealObserver = null

function setupRevealObserver() {
    if (!revealElements.length) return

    if (revealObserver) {
        revealObserver.disconnect()
        revealObserver = null
    }

    if (prefersReducedMotion() || isSmallScreen()) {
        revealElements.forEach((element) => element.classList.add('is-visible'))
        return
    }

    revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return

            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
        })
    }, {
        threshold: 0.14,
        rootMargin: '0px 0px -48px 0px'
    })

    revealElements
        .filter((element) => !element.classList.contains('is-visible'))
        .forEach((element) => revealObserver.observe(element))
}

setupRevealObserver()
bindMediaChange(reduceMotionQuery, setupRevealObserver)
bindMediaChange(mobileQuery, setupRevealObserver)

const footerCopy = document.querySelector('.footer__copy')

if (footerCopy) {
    footerCopy.textContent = t.footerCopy(new Date().getFullYear())
}

const testimonialsSection = document.querySelector('.testimonials')
const testimonialsViewport = document.querySelector('.testimonials__viewport')
const testimonialsSlider = document.querySelector('.testimonials__slider')
const arrowLeft = document.querySelector('.testimonials__arrow--left')
const arrowRight = document.querySelector('.testimonials__arrow--right')

if (testimonialsSection && testimonialsViewport && testimonialsSlider && arrowLeft && arrowRight) {
    let currentIndex = 0
    const testimonialCards = Array.from(testimonialsSlider.querySelectorAll('.testimonial-card'))

    const getSlidesPerView = () => {
        const value = Number.parseInt(
            getComputedStyle(testimonialsSection).getPropertyValue('--slides-per-view'),
            10
        )

        return Number.isNaN(value) ? 1 : value
    }

    const getGap = () => {
        const styles = getComputedStyle(testimonialsSlider)
        return Number.parseFloat(styles.columnGap || styles.gap) || 0
    }

    const getMaxIndex = () => Math.max(0, testimonialCards.length - getSlidesPerView())

    const updateArrows = () => {
        const hasOverflow = testimonialCards.length > getSlidesPerView()
        const showArrows = hasOverflow && !isSmallScreen()

        arrowLeft.hidden = !showArrows
        arrowRight.hidden = !showArrows
        arrowLeft.disabled = currentIndex === 0 || !hasOverflow
        arrowRight.disabled = currentIndex >= getMaxIndex() || !hasOverflow
    }

    const updateSlider = ({ resetScroll = false } = {}) => {
        currentIndex = Math.max(0, Math.min(currentIndex, getMaxIndex()))

        if (isSmallScreen()) {
            testimonialsSlider.style.transform = ''

            if (resetScroll) {
                testimonialsViewport.scrollLeft = 0
            }

            updateArrows()
            return
        }

        const firstCard = testimonialCards[0]
        if (!firstCard) return

        const offset = currentIndex * (firstCard.getBoundingClientRect().width + getGap())
        testimonialsSlider.style.transform = `translateX(-${offset}px)`
        updateArrows()
    }

    arrowRight.addEventListener('click', () => {
        if (currentIndex >= getMaxIndex()) return
        currentIndex += 1
        updateSlider()
    })

    arrowLeft.addEventListener('click', () => {
        if (currentIndex <= 0) return
        currentIndex -= 1
        updateSlider()
    })

    let resizeTimer = null

    const handleResize = () => {
        window.clearTimeout(resizeTimer)
        resizeTimer = window.setTimeout(() => updateSlider({ resetScroll: true }), 120)
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('load', () => updateSlider({ resetScroll: true }))

    if (typeof ResizeObserver === 'function') {
        const sliderResizeObserver = new ResizeObserver(() => updateSlider())
        sliderResizeObserver.observe(testimonialsViewport)
    }

    updateSlider()
}

const GSHEET_ID = ''

function escapeHTML(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')
}

function parseCSVLine(line) {
    const result = []
    let current = ''
    let inQuotes = false

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index]
        const nextChar = line[index + 1]

        if (char === '"' && inQuotes && nextChar === '"') {
            current += '"'
            index += 1
            continue
        }

        if (char === '"') {
            inQuotes = !inQuotes
            continue
        }

        if (char === ',' && !inQuotes) {
            result.push(current.trim())
            current = ''
            continue
        }

        current += char
    }

    result.push(current.trim())
    return result
}

function parseCSV(csvText) {
    return csvText
        .split(/\r?\n/)
        .slice(1)
        .map((line) => line.trim())
        .filter(Boolean)
        .map(parseCSVLine)
        .filter((values) => values.length >= 4)
        .map((values) => ({
            title: values[0] || 'Sin titulo',
            date: values[1] || '',
            image: values[2] || '',
            excerpt: values[3] || '',
            link: values[4] || '#'
        }))
}

function createBlogPostHTML(post) {
    return `
        <article class="project-card">
            <span class="project-card__pill">${escapeHTML(post.date || 'Novedad')}</span>
            <h3>${escapeHTML(post.title)}</h3>
            <p>${escapeHTML(post.excerpt)}</p>
        </article>
    `
}

async function loadBlogPosts() {
    const blogSection = document.getElementById('blog')
    const blogContainer = document.getElementById('blog-container')
    const blogLoading = document.getElementById('blog-loading')
    const blogEmpty = document.getElementById('blog-empty')
    const blogError = document.getElementById('blog-error')

    if (!blogContainer || blogSection?.hidden) return

    if (!GSHEET_ID) {
        if (blogLoading) blogLoading.style.display = 'none'
        if (blogEmpty) blogEmpty.style.display = 'block'
        return
    }

    try {
        if (blogLoading) blogLoading.style.display = 'block'
        if (blogEmpty) blogEmpty.style.display = 'none'
        if (blogError) blogError.style.display = 'none'

        const csvUrl = `https://docs.google.com/spreadsheets/d/${GSHEET_ID}/export?format=csv&gid=0`
        const response = await fetch(csvUrl)

        if (!response.ok) {
            throw new Error('Error al cargar los datos')
        }

        const csvText = await response.text()
        const posts = parseCSV(csvText)

        if (blogLoading) blogLoading.style.display = 'none'

        if (!posts.length) {
            if (blogEmpty) blogEmpty.style.display = 'block'
            return
        }

        blogContainer.innerHTML = posts.map(createBlogPostHTML).join('')
    } catch (error) {
        console.error('Error cargando blog posts:', error)
        if (blogLoading) blogLoading.style.display = 'none'
        if (blogError) blogError.style.display = 'block'
    }
}

window.addEventListener('load', () => {
    updateHeaderState()
    updateActiveLink()
    loadBlogPosts()
})

/* ── Modal: Carta de la Directora ── */
;(function () {
    const modal = document.getElementById('letter-modal')
    const openBtn = document.getElementById('btn-carta-directora')
    const closeBtn = document.getElementById('letter-modal-close')
    const backdrop = modal?.querySelector('.letter-modal__backdrop')

    if (!modal || !openBtn) return

    function openModal() {
        modal.removeAttribute('hidden')
        document.body.style.overflow = 'hidden'
        closeBtn?.focus()
    }

    function closeModal() {
        modal.setAttribute('hidden', '')
        document.body.style.overflow = ''
        openBtn?.focus()
    }

    openBtn.addEventListener('click', openModal)
    closeBtn?.addEventListener('click', closeModal)
    backdrop?.addEventListener('click', closeModal)

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.hasAttribute('hidden')) {
            closeModal()
        }
    })
})()
