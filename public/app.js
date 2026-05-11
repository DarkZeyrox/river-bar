let menu=[];
async function loadMenu(){
  const res=await fetch('/api/menu'); menu=await res.json();
  document.getElementById('menuList').innerHTML=menu.map(i=>`<div class="menuRow"><div><div class="itemName">${escapeHtml(i.name)}</div><div>${i.discount>0?`<span class="old">${i.price} $</span>`:''}<span class="price">${i.finalPrice} $</span>${i.discount>0?`<span class="discount">-${i.discount}%</span>`:''}</div></div><input aria-label="Quantité ${escapeAttr(i.name)}" type="number" min="0" max="99" value="0" data-id="${i.id}" oninput="updateTotal()"></div>`).join('') || '<p class="empty">La carte est vide pour le moment.</p>';
}
function getCart(){return [...document.querySelectorAll('[data-id]')].map(i=>({id:i.dataset.id,qty:Number(i.value)||0})).filter(i=>i.qty>0)}
function updateTotal(){const total=getCart().reduce((s,l)=>{const it=menu.find(m=>m.id===l.id);return s+(it?it.finalPrice*l.qty:0)},0);document.getElementById('cartTotal').textContent=total+' $'}
document.getElementById('orderForm').addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target).entries());data.cart=getCart();const msg=document.getElementById('message');msg.textContent='Envoi en cours…';const res=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const json=await res.json();if(!res.ok){msg.textContent=json.error||'Erreur.';return}msg.textContent='Commande envoyée au River Bar ✅';e.target.reset();document.querySelectorAll('[data-id]').forEach(i=>i.value=0);updateTotal()});
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function escapeAttr(s){return escapeHtml(s)}
loadMenu();
