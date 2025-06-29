const text = "Hello, my name is Abhaysai Vemula!";
let index = 0;
const typewriter = document.getElementById("typewriter");
const resumeButton = document.getElementById("resume-button");
const iconRow = document.getElementById("icon-row");
const navDiv = document.getElementById("nav-div");
const navBar = document.getElementsByClassName("navbar");
const navItems = document.querySelectorAll(".nav-item");

function typeAndShowContent() {
  if (index < text.length) {
    typewriter.innerHTML += text.charAt(index);
    index++;
    setTimeout(typeAndShowContent, 100);
  } else {
    typewriter.style.borderRight = "none";

    // Animate nav buttons one by one

    navBar.add;
    navDiv.classList.remove("hidden");
    navDiv.classList.add("visible");

    navItems.forEach((item, i) => {
      setTimeout(() => {
        item.classList.add("visible");
      }, i * 200);
    });

    // Show about text and icons after nav
    setTimeout(() => {
      iconRow.classList.remove("hidden");
      iconRow.classList.add("visible");

      setTimeout(() => {
        resumeButton.classList.remove("hidden");
        resumeButton.classList.add("visible");
      }, 800);
    }, navItems.length * 200 + 800);
  }
}

window.onload = typeAndShowContent;

// Magnetic repel effect
navItems.forEach((item, i) => {
  item.addEventListener("mouseenter", () => {
    item.classList.add("hovering");
    if (navItems[i - 1]) navItems[i - 1].classList.add("repel-left");
    if (navItems[i + 1]) navItems[i + 1].classList.add("repel-right");
  });

  item.addEventListener("mouseleave", () => {
    item.classList.remove("hovering");
    if (navItems[i - 1]) navItems[i - 1].classList.remove("repel-left");
    if (navItems[i + 1]) navItems[i + 1].classList.remove("repel-right");
  });
});
