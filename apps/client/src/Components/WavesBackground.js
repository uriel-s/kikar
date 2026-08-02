import React, { useEffect, useRef, useState } from "react";

// Module scope, not component scope: this is a constant, and rebuilding it on
// every render made it a changing dependency of the animation effect, which
// would tear down and restart the canvas loop on each re-render.
const colorThemes = {
    blue: [
      'rgba(0, 102, 204, 0.3)',
      'rgba(0, 153, 204, 0.25)',
      'rgba(52, 152, 219, 0.2)',
      'rgba(41, 128, 185, 0.15)',
      'rgba(0, 180, 255, 0.1)'
    ],
    purple: [
      'rgba(155, 89, 182, 0.3)',
      'rgba(142, 68, 173, 0.25)',
      'rgba(155, 89, 210, 0.2)',
      'rgba(120, 73, 175, 0.15)',
      'rgba(175, 65, 185, 0.1)'
    ],
    green: [
      'rgba(39, 174, 96, 0.3)',
      'rgba(46, 204, 113, 0.25)',
      'rgba(88, 214, 141, 0.2)',
      'rgba(30, 144, 90, 0.15)',
      'rgba(0, 148, 80, 0.1)'
    ],
    sunset: [
      'rgba(231, 76, 60, 0.3)',
      'rgba(230, 126, 34, 0.25)',
      'rgba(241, 196, 15, 0.2)',
      'rgba(243, 156, 18, 0.15)',
      'rgba(211, 84, 0, 0.1)'
    ]
  };

const WavesBackground = ({ showControls = false }) => {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: null, y: null });

  const [waveConfig, setWaveConfig] = useState({
    waveCount: 5,
    colorTheme: 'blue',
    interactive: false,
    speedMultiplier: 2.5,
    amplitude: 1.5,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let animationFrameId;
    
    // Set canvas dimensions
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    window.addEventListener("resize", handleResize);
    handleResize();
    
    // Mouse interaction
    const handleMouseMove = (event) => {
      mouseRef.current = {
        x: event.clientX,
        y: event.clientY
      };
    };
    
    const handleMouseLeave = () => {
      mouseRef.current = { x: null, y: null };
    };
    
    if (waveConfig.interactive) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseleave", handleMouseLeave);
    }
    // Generate waves based on config - distribute waves evenly across the entire screen
    const colors = colorThemes[waveConfig.colorTheme];
    const waves = [];
      // Create waves that span and fill the entire screen - starting lower for more ocean-like look
    for (let i = 0; i < waveConfig.waveCount; i++) {
      const colorIndex = i % colors.length;
      
      // Distribute waves evenly across the screen height
      // Start from middle of screen (0.5) and go all the way to bottom (0.9)
      // This change ensures waves are more visible in the lower part of the screen
      const baseHeightPosition = 0.5 + ((i / (waveConfig.waveCount - 1)) * 0.4);
      
      waves.push({
        // Use varying wavelengths for more natural appearance - gentler waves
        waveLength: 0.001 + (i * 0.0003),
          // Amplitude decreases gradually for lower waves (more stable at bottom)
        // Increased for more obvious wave motion
        amplitude: canvas.height * (0.035 - (i * 0.003)) * waveConfig.amplitude,
          // Increased speed to make wave movement more noticeable
        speed: (0.0010 - (i * 0.00008)) * waveConfig.speedMultiplier,
        
        // Different phase offsets create more varied wave patterns
        offset: i * Math.PI * 0.5,
        
        color: colors[colorIndex], // Cycle through theme colors
        baseHeight: baseHeightPosition, // Distributed evenly across screen
        
        // Add secondary wave parameters for more complex, natural wave shapes
        secondaryWaveLength: 0.004 + (i * 0.001),
        secondaryAmplitude: 0.3, // Relative to primary amplitude
        secondaryOffset: i * 2.5
      });
    }
      // Animation loop - uses requestAnimationFrame for smooth animation
    const render = () => {
      // Create a deeper, more dramatic gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#111318'); // Darker at top
      gradient.addColorStop(0.5, '#1a1c22');
      gradient.addColorStop(1, '#242731'); // Slightly lighter at bottom
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // הסרנו את הנקודות הלבנות (כוכבים) לפי בקשת המשתמש
      
      // Update and draw each wave - in reverse order so deeper waves are drawn first (bottom to top)
      [...waves].reverse().forEach((wave, index) => {
        // Update wave offsets with increased speeds for more visible movement
        wave.offset += wave.speed * 1.2;
        wave.secondaryOffset += wave.speed * 1.5;
        
        // Draw wave path
        ctx.beginPath();
        
        // Start the path from the left edge at the wave's base height
        ctx.moveTo(0, canvas.height * wave.baseHeight);
        
        // Draw wave using a combined sine function for more natural waves
        for (let x = 0; x < canvas.width; x += 3) { // Smaller step (3px) for smoother curves
          // Combine primary and secondary waves with different frequencies for more natural look
          // Use multiple sine waves with different phases, frequencies, and amplitudes
          let y = canvas.height * wave.baseHeight + 
                  Math.sin(x * wave.waveLength + wave.offset) * wave.amplitude * 0.6 +
                  Math.sin(x * wave.secondaryWaveLength + wave.secondaryOffset) * wave.amplitude * wave.secondaryAmplitude +
                  Math.sin(x * wave.waveLength * 3 + wave.offset * 1.3) * wave.amplitude * 0.1; // Third harmonic
          
          // Add mouse interaction with smoother effect
          if (waveConfig.interactive && mouseRef.current.x !== null) {
            const dx = x - mouseRef.current.x;
            const dy = canvas.height * wave.baseHeight - mouseRef.current.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 350) { // Increased interaction radius
              // Create a more natural wave effect near mouse with smooth falloff
              const factor = Math.pow(1 - Math.min(1, distance / 350), 2.5);
              const mouseEffect = Math.sin(dx * 0.01) * factor * wave.amplitude * 4;
              y += mouseEffect;
            }
          }
          
          ctx.lineTo(x, y);
        }
        
        // Complete the path by extending to the bottom of screen
        ctx.lineTo(canvas.width, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.closePath();
        
        // Create a more natural-looking gradient for each wave
        const waveGradient = ctx.createLinearGradient(
          0, canvas.height * wave.baseHeight - wave.amplitude * 1.5, 
          0, canvas.height
        );
        
        // Extract base color without opacity
        const baseColor = wave.color.replace(/[\d.]+\)$/, '');
        
        // More vibrant gradient with better depth
        // Start with the defined color at the top of the wave
        waveGradient.addColorStop(0, wave.color);
        // Transition to a more transparent version in the middle
        waveGradient.addColorStop(0.3, baseColor + '0.3)');
        // End with very transparent at bottom of screen
        waveGradient.addColorStop(0.8, baseColor + '0.1)');
        waveGradient.addColorStop(1, 'rgba(0, 0, 20, 0.05)');
        
        ctx.fillStyle = waveGradient;
        ctx.fill();
        
        // Add a subtle highlight on top of each wave for depth
        ctx.beginPath();
        ctx.moveTo(0, canvas.height * wave.baseHeight);
        
        for (let x = 0; x < canvas.width; x += 5) { // Can use larger steps for highlight
          // Just use primary wave for highlight
          const y = canvas.height * wave.baseHeight + 
                    Math.sin(x * wave.waveLength + wave.offset) * wave.amplitude;
          ctx.lineTo(x, y);
        }
        
        ctx.lineWidth = 1;
        // Add slight glow to the highlight depending on theme
        let highlightColor;
        switch(waveConfig.colorTheme) {
          case 'blue':
            highlightColor = 'rgba(120, 200, 255, 0.15)';
            break;
          case 'purple':
            highlightColor = 'rgba(180, 160, 240, 0.15)';
            break;
          case 'green':
            highlightColor = 'rgba(130, 230, 180, 0.15)';
            break;
          case 'sunset':
            highlightColor = 'rgba(255, 200, 150, 0.15)';
            break;
          default:
            highlightColor = 'rgba(255, 255, 255, 0.1)';
        }
        ctx.strokeStyle = highlightColor;
        ctx.stroke();
      });
      
      animationFrameId = window.requestAnimationFrame(render);
    };
    
    render();
    
    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      
      if (waveConfig.interactive) {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseleave", handleMouseLeave);
      }
    };
  }, [waveConfig]);

  // Controls for adjusting wave parameters
  const handleConfigChange = (key, value) => {
    setWaveConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: -1
        }}
      />
      
      {showControls && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          background: 'rgba(26, 28, 34, 0.8)',
          padding: '15px',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          width: '250px',
          boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)'
        }}>
          <h3 style={{ margin: '0 0 10px 0', textAlign: 'center' }}>הגדרות גלים</h3>
          
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>צבע הגלים:</label>
            <select 
              value={waveConfig.colorTheme}
              onChange={e => handleConfigChange('colorTheme', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '5px',
                background: '#353945',
                color: 'white',
                border: '1px solid #3a3f4b'
              }}
            >
              <option value="blue">כחול</option>
              <option value="purple">סגול</option>
              <option value="green">ירוק</option>
              <option value="sunset">שקיעה</option>
            </select>
          </div>
            <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              מספר גלים: {waveConfig.waveCount}
            </label>
            <input 
              type="range" 
              min="3" 
              max="10" 
              value={waveConfig.waveCount}
              onChange={e => handleConfigChange('waveCount', parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
            <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              גובה גלים: {waveConfig.amplitude.toFixed(1)}
            </label>
            <input 
              type="range" 
              min="0.4" 
              max="2.5" 
              step="0.1"
              value={waveConfig.amplitude}
              onChange={e => handleConfigChange('amplitude', parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          
          <div>            <label style={{ display: 'block', marginBottom: '5px' }}>
              מהירות גלים: {waveConfig.speedMultiplier.toFixed(1)}
            </label>
            <input type="range" 
              min="0.3" 
              max="3.0" 
              step="0.1"
              value={waveConfig.speedMultiplier}
              onChange={e => handleConfigChange('speedMultiplier', parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
  
            {/* הסרנו את בקר מספר הכוכבים */}
          
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '5px' }}>
            <input 
              type="checkbox"
              checked={waveConfig.interactive}
              onChange={e => handleConfigChange('interactive', e.target.checked)}
              id="interactive-waves"
            />
            <label htmlFor="interactive-waves" style={{ marginLeft: '10px' }}>
              אינטראקטיבי עם העכבר
            </label>
          </div>
        </div>
      )}
    </>
  );
};

export default WavesBackground;
