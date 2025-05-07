tsParticles.load("particles-js", {
    particles: {
      number: {
        value: 30,
        density: {
          enable: true,
          area: 800
        }
      },
      shape: {
        type: "image",
        image: [
          {
            src: "img/particles/microphone.png",
            width: 32,
            height: 32
          },
          {
            src: "img/particles/speaker.png",
            width: 32,
            height: 32
          },
          {
            src: "img/particles/megaphone.png",
            width: 32,
            height: 32
          },
          {
            src: "img/particles/volume.png",
            width: 32,
            height: 32
          }
        ]
      },
      opacity: {
        value: 0.8,
        random: true
      },
      size: {
        value: 24,
        random: { enable: true, minimumValue: 16 }
      },
      move: {
        enable: true,
        speed: 1.2,
        direction: "none",
        random: true,
        straight: false,
        outModes: {
          default: "out"
        }
      }
    },
    background: {
      color: "#0f0f1a"
    },
    retina_detect: true
  });
  