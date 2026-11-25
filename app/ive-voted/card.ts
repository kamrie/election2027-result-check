import { brandName, brandTagline } from "@/lib/brand";

const green = "#008751";
const dark = "#005C37";
const white = "#FFFFFF";
const ink = "#073C30";

export async function loadCardFonts(text: string) {
  await Promise.all([
    document.fonts.load('900 143px "Montserrat Variable"', "I’ve Voted!"),
    document.fonts.load('800 56px "Montserrat Variable"', `${brandName} Nigeria 2027 General Election`),
    document.fonts.load('800 70px "Montserrat Variable"', text || brandName),
    document.fonts.load('700 43px "Montserrat Variable"', `${brandTagline} My vote. My voice. Our democracy.`),
  ]);
}

export function drawCard(canvas: HTMLCanvasElement, name: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.textAlign = "left";
  ctx.lineJoin = "round";
  ctx.lineCap = "square";

  function shape(color: string, points: [number, number][]) {
    if (!ctx) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    ctx.closePath();
    ctx.fill();
  }

  const background = ctx.createLinearGradient(0, 0, 0, 760);
  background.addColorStop(0, "#005437");
  background.addColorStop(0.58, "#007241");
  background.addColorStop(0.73, "#25A34F");
  background.addColorStop(0.93, "#EDF8EB");
  background.addColorStop(1, white);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 1080, 1080);

  const ribbons = [
    { offset: -100, color: "#004B31" },
    { offset: -68, color: green },
    { offset: 43, color: "#F6FBF7" },
    { offset: 143, color: "#007648" },
  ];
  for (const { offset, color } of ribbons) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(785 + offset, 0);
    ctx.bezierCurveTo(919 + offset, 37, 850 + offset, 208, 1080 + offset, 243);
    ctx.lineTo(1191 + offset, 243);
    ctx.bezierCurveTo(961 + offset, 208, 1030 + offset, 37, 896 + offset, 0);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = white;
  ctx.lineWidth = 8;
  ctx.beginPath();
  for (let x = 89; x < 175; x += 21) {
    ctx.moveTo(x, 48);
    ctx.lineTo(x, 132);
  }
  ctx.moveTo(78, 123);
  ctx.lineTo(191, 60);
  ctx.stroke();
  ctx.fillStyle = white;
  ctx.font = '800 68px "Montserrat Variable", sans-serif';
  ctx.fillText(brandName, 218, 94);
  ctx.font = '700 27px "Montserrat Variable", sans-serif';
  ctx.fillText(brandTagline, 220, 130);

  ctx.lineWidth = 20;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(246, 258);
  ctx.lineTo(119, 258);
  ctx.quadraticCurveTo(112, 258, 112, 266);
  ctx.lineTo(112, 418);
  ctx.quadraticCurveTo(112, 426, 120, 426);
  ctx.lineTo(274, 426);
  ctx.quadraticCurveTo(282, 426, 282, 418);
  ctx.lineTo(282, 326);
  ctx.stroke();
  ctx.lineWidth = 29;
  ctx.beginPath();
  ctx.moveTo(156, 334);
  ctx.lineTo(198, 379);
  ctx.lineTo(308, 229);
  ctx.stroke();

  ctx.font = '900 143px "Montserrat Variable", sans-serif';
  ctx.fillText("I’ve", 351, 301);
  ctx.fillText("Voted!", 351, 430, 498);
  shape("#009855", [[853, 340], [896, 326], [896, 418], [853, 431]]);
  shape(white, [[896, 326], [939, 334], [939, 426], [896, 418]]);
  shape("#009855", [[939, 334], [982, 321], [982, 413], [939, 426]]);

  ctx.textAlign = "center";
  ctx.fillStyle = white;
  ctx.fillRect(85, 485, 910, 92);
  ctx.fillStyle = "#007044";
  ctx.font = '800 53px "Montserrat Variable", sans-serif';
  ctx.fillText("Nigeria 2027 General Election", 540, 547, 864);

  ctx.fillStyle = ink;
  if (name) {
    let size = 74;
    ctx.font = `800 ${size}px "Montserrat Variable", sans-serif`;
    while (size > 28 && ctx.measureText(name).width > 840) {
      size -= 2;
      ctx.font = `800 ${size}px "Montserrat Variable", sans-serif`;
    }
    ctx.fillText(name, 540, 680, 840);
  }
  ctx.font = '700 47px "Montserrat Variable", sans-serif';
  ctx.fillText("My vote. My voice. Our democracy.", 540, name ? 764 : 713, 940);

  const skyline = "#83BEA3";
  for (const [x, y, width] of [[58, 844, 20], [96, 908, 35], [136, 919, 25], [172, 914, 45], [232, 896, 24], [266, 864, 18], [300, 919, 41], [757, 917, 36], [807, 899, 25], [845, 880, 39], [893, 900, 25], [935, 911, 26], [993, 835, 17]]) {
    ctx.fillStyle = skyline;
    ctx.fillRect(x, y, width, 982 - y);
    shape(skyline, [[x, y], [x + width / 2, y - Math.min(width, 17)], [x + width, y]]);
  }
  ctx.fillStyle = "#00774A";
  ctx.fillRect(360, 940, 362, 43);
  ctx.fillRect(475, 886, 130, 97);
  ctx.beginPath();
  ctx.ellipse(540, 887, 52, 52, 0, Math.PI, 2 * Math.PI);
  ctx.fill();
  ctx.fillRect(538, 818, 4, 20);
  shape("#00774A", [[363, 940], [415, 909], [468, 940]]);
  shape("#00774A", [[612, 940], [664, 909], [722, 940]]);
  ctx.fillStyle = "#D8F2E3";
  for (let x = 374; x < 716; x += 19) ctx.fillRect(x, 948, 8, 28);
  for (let x = 485; x < 600; x += 22) ctx.fillRect(x, 898, 11, 37);

  shape(white, [[0, 933], [296, 987], [540, 1006], [812, 984], [1080, 926], [1080, 1080], [0, 1080]]);
  shape("#009951", [[0, 933], [293, 1017], [540, 1047], [820, 1001], [1080, 933], [1080, 1080], [0, 1080]]);
  shape(dark, [[0, 1001], [223, 1045], [540, 1067], [848, 1038], [1080, 994], [1080, 1080], [0, 1080]]);
  ctx.fillStyle = white;
  ctx.font = '600 13px "Montserrat Variable", sans-serif';
  ctx.fillText("Personal statement · Not official proof of voting", 540, 1077);
}
