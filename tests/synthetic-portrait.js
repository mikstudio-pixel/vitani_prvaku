// Test artwork only. No photograph or external asset is used.
export function paintPortrait(canvas) {
  const c = canvas.getContext('2d'), n = canvas.width;
  c.save(); c.scale(n / 512, n / 512);
  const background = c.createLinearGradient(0, 0, 512, 512); background.addColorStop(0, '#ddd'); background.addColorStop(1, '#777');
  c.fillStyle = background; c.fillRect(0, 0, 512, 512);
  c.fillStyle = '#252525'; c.beginPath(); c.ellipse(256, 520, 165, 140, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#bbb'; c.fillRect(223, 315, 66, 105);
  const face = c.createLinearGradient(150, 0, 350, 0); face.addColorStop(0, '#777'); face.addColorStop(.45, '#e5e5e5'); face.addColorStop(1, '#aaa');
  c.fillStyle = face; c.beginPath(); c.ellipse(256, 230, 103, 150, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#222'; c.beginPath(); c.ellipse(256, 121, 105, 58, -.15, Math.PI, Math.PI * 2); c.lineTo(356, 159); c.lineTo(304, 129); c.lineTo(207, 126); c.lineTo(155, 161); c.closePath(); c.fill();
  c.fillStyle = '#333'; c.beginPath(); c.ellipse(217, 212, 23, 7, 0, 0, Math.PI * 2); c.ellipse(296, 212, 23, 7, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#888'; c.lineWidth = 7; c.beginPath(); c.moveTo(258, 224); c.lineTo(248, 280); c.lineTo(265, 284); c.stroke();
  c.strokeStyle = '#555'; c.lineWidth = 9; c.beginPath(); c.moveTo(218, 307); c.quadraticCurveTo(255, 330, 295, 304); c.stroke();
  c.restore();
}
