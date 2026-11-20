'use strict';

const signinImages = [
  {id:'reading-room', full:'images/reading-room-hd.webp', title:'Reading room', alt:'A library reading room seen from the floor above', credit:'Mitchell Luo', source:'https://www.pexels.com/photo/people-inside-a-library-11773474/', position:'63% 50%'},
  {id:'window-desk', full:'images/window-desk-hd.webp', position:'52% 53%', title:'Window desk', alt:'Open books and papers spread across a desk by a window', credit:'Ron Lach', source:'https://www.pexels.com/photo/open-books-lying-on-desk-9871139/'},
  {id:'stacks', full:'images/stacks-hd.webp', position:'50% 61%', title:'Library stacks', alt:'A reader in the distance at the end of a library aisle', credit:'Helin Gezer', source:'https://www.pexels.com/photo/moody-library-aisle-with-study-space-28479793/'},
  {id:'lecture-hall', title:'Lecture hall', alt:'A lecturer and students seen from the back of a lecture hall'},
  {id:'paperwork', full:'images/paperwork-refined.webp', title:'Paperwork', alt:'An overhead view of a hand turning a page among papers and notes'},
  {id:'office-door', full:'images/office-door-refined.webp', title:'Office doorway', alt:'A teacher seen through a doorway at a desk full of papers'}
];
let signinImage = signinImages.find(image => image.id === new URLSearchParams(location.search).get('image')) || signinImages.find(image => image.id === 'window-desk');

function imagePath(photo, thumbnail=false) {
  return thumbnail ? `images/thumbs/${photo.id}.webp` : photo.full || `images/${photo.id}.webp`;
}

function imageCredit(photo) {
  return photo.source
    ? `<a href="${photo.source}" target="_blank" rel="noopener">${photo.credit} / Pexels</a>`
    : 'Generated study';
}

function signinGallery() {
  return `<figure class="signin-photo">
    <div class="signin-image"><img fetchpriority="high" src="${imagePath(signinImage)}" alt="${signinImage.alt}" style="object-position:${signinImage.position || 'center'}"></div>
    <figcaption class="signin-gallery">
      <p id="signin-image-caption" aria-live="polite"><strong>${signinImage.title}</strong><span>${imageCredit(signinImage)}</span></p>
      <div class="signin-thumbs" role="group" aria-label="Sign-in image">
        ${signinImages.map(photo=>`<button type="button" data-image="${photo.id}" aria-label="${photo.title}" title="${photo.title}" aria-pressed="${photo===signinImage}"><img src="${imagePath(photo,true)}" alt=""></button>`).join('')}
      </div>
    </figcaption>
  </figure>`;
}

document.addEventListener('click', event => {
  const button = event.target.closest('.signin-thumbs [data-image]');
  if (!button) return;
  const photo = signinImages.find(image => image.id === button.dataset.image);
  if (!photo || photo === signinImage) return;
  signinImage = photo;
  const url = new URL(location.href);
  url.searchParams.set('image',photo.id);
  history.replaceState(null,'',url);
  const gallery = button.closest('.signin-photo');
  const oldImage = gallery.querySelector('.signin-image img');
  // Keep the current decoded image visible until its replacement is ready.
  const replacement = new Image();
  replacement.alt = photo.alt;
  replacement.style.objectPosition = photo.position || 'center';
  replacement.src = imagePath(photo);
  gallery.querySelectorAll('[data-image]').forEach(item => item.setAttribute('aria-pressed',String(item===button)));
  replacement.decode().then(() => {
    if (photo !== signinImage || !oldImage.isConnected) return;
    oldImage.replaceWith(replacement);
    gallery.querySelector('#signin-image-caption').innerHTML = `<strong>${photo.title}</strong><span>${imageCredit(photo)}</span>`;
    if (event.detail && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      replacement.animate([{opacity:.65},{opacity:1}],{duration:180,easing:'cubic-bezier(.23,1,.32,1)'});
    }
  }).catch(() => {
    if (photo !== signinImage || !oldImage.isConnected) return;
    signinImage = signinImages.find(image => oldImage.src.endsWith(imagePath(image)));
    url.searchParams.set('image',signinImage.id);
    history.replaceState(null,'',url);
    gallery.querySelectorAll('[data-image]').forEach(item => item.setAttribute('aria-pressed',String(item.dataset.image===signinImage.id)));
  });
});
