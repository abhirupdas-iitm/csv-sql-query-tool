(function() {
    // Wait for DOM
    document.addEventListener("DOMContentLoaded", () => {
        const canvas = document.createElement('canvas');
        canvas.id = 'floating-symbols-bg';
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.zIndex = '-1';
        canvas.style.pointerEvents = 'none';
        document.body.prepend(canvas);

        const ctx = canvas.getContext('2d');
        let width = window.innerWidth;
        let height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;

        window.addEventListener('resize', () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        });

        const symbols = ['▶', '≡', '✓', '↳', '#', '✓✓'];
        const particles = [];
        const numParticles = 25; // Good amount of density

        for (let i = 0; i < numParticles; i++) {
            particles.push(createParticle());
        }

        function createParticle() {
            return {
                x: Math.random() * width,
                y: Math.random() * height,
                symbol: symbols[Math.floor(Math.random() * symbols.length)],
                size: Math.random() * 25 + 20, // 20 to 45
                speedX: (Math.random() - 0.5) * 0.8,
                speedY: (Math.random() - 0.5) * 0.8,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.015,
                depth: Math.floor(Math.random() * 6) + 3, // 3 to 8
                opacity: Math.random() * 0.5 + 0.2 // 0.2 to 0.7
            };
        }

        function getAccentColor() {
            const rootStyles = getComputedStyle(document.documentElement);
            let accent = rootStyles.getPropertyValue('--accent').trim();
            if (!accent) accent = '#00e676';
            return accent;
        }

        function animate() {
            ctx.clearRect(0, 0, width, height);
            
            const accentColor = getAccentColor();
            
            particles.forEach(p => {
                p.x += p.speedX;
                p.y += p.speedY;
                p.rotation += p.rotationSpeed;

                // Wrap around with a bit of margin
                const margin = p.size * 2;
                if (p.x > width + margin) p.x = -margin;
                if (p.x < -margin) p.x = width + margin;
                if (p.y > height + margin) p.y = -margin;
                if (p.y < -margin) p.y = height + margin;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation);
                ctx.font = `bold ${p.size}px "Courier New", monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                // Extrusion for 3D effect
                // We draw the shadow multiple times with low opacity
                ctx.fillStyle = accentColor;
                for (let i = p.depth; i > 0; i--) {
                    ctx.globalAlpha = p.opacity * 0.3; // dark shadow
                    ctx.fillText(p.symbol, i, i);
                }

                // Front face
                ctx.globalAlpha = p.opacity;
                ctx.shadowColor = accentColor;
                ctx.shadowBlur = 15; // glowing effect
                ctx.fillText(p.symbol, 0, 0);

                ctx.restore();
            });

            requestAnimationFrame(animate);
        }

        animate();
    });
})();
