const canvas = document.querySelector("#relay-canvas");
const context = canvas.getContext("2d");
const nodes = [];
const colors = ["#20c997", "#38d9e8", "#f59f00", "#ff6b6b"];

function resize() {
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(canvas.clientWidth * scale);
  canvas.height = Math.floor(canvas.clientHeight * scale);
  context.setTransform(scale, 0, 0, scale, 0, 0);
}

function seed() {
  nodes.length = 0;
  const count = Math.max(18, Math.floor(window.innerWidth / 58));
  for (let index = 0; index < count; index += 1) {
    nodes.push({
      x: Math.random() * canvas.clientWidth,
      y: Math.random() * canvas.clientHeight,
      r: 2 + Math.random() * 3,
      vx: -0.24 + Math.random() * 0.48,
      vy: -0.18 + Math.random() * 0.36,
      color: colors[index % colors.length],
      phase: Math.random() * Math.PI * 2
    });
  }
}

function draw() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  context.clearRect(0, 0, width, height);

  const gridSize = 72;
  context.strokeStyle = "rgba(246, 241, 230, 0.045)";
  context.lineWidth = 1;
  for (let x = 0; x < width; x += gridSize) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 0; y < height; y += gridSize) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  for (let a = 0; a < nodes.length; a += 1) {
    for (let b = a + 1; b < nodes.length; b += 1) {
      const dx = nodes[a].x - nodes[b].x;
      const dy = nodes[a].y - nodes[b].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 190) {
        context.strokeStyle = `rgba(32, 201, 151, ${0.13 * (1 - dist / 190)})`;
        context.beginPath();
        context.moveTo(nodes[a].x, nodes[a].y);
        context.lineTo(nodes[b].x, nodes[b].y);
        context.stroke();
      }
    }
  }

  for (const node of nodes) {
    node.x += node.vx;
    node.y += node.vy;
    node.phase += 0.015;

    if (node.x < -20) node.x = width + 20;
    if (node.x > width + 20) node.x = -20;
    if (node.y < -20) node.y = height + 20;
    if (node.y > height + 20) node.y = -20;

    const pulse = 0.8 + Math.sin(node.phase) * 0.25;
    context.beginPath();
    context.fillStyle = node.color;
    context.shadowColor = node.color;
    context.shadowBlur = 18;
    context.arc(node.x, node.y, node.r * pulse, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
  }

  requestAnimationFrame(draw);
}

resize();
seed();
draw();

window.addEventListener("resize", () => {
  resize();
  seed();
});
