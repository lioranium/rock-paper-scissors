// This file contains the JavaScript code for the Rock-Paper-Scissors game logic.

const VALID = ['rock','paper','scissors'];

function getParams(){
    return new URLSearchParams(window.location.search);
}

function sanitizeChoice(c){
    if(!c) return null;
    c = String(c).toLowerCase();
    return VALID.includes(c) ? c : null;
}

/* --- added: Web Crypto helpers for encrypting the p1 param --- */
function bufToBase64(buf){
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}
function base64ToBuf(b64){
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
}
async function generateAesKeyBase64(){
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt','decrypt']);
    const raw = await crypto.subtle.exportKey('raw', key);
    return { key, keyB64: bufToBase64(raw) };
}
async function importAesKeyFromBase64(keyB64){
    const raw = base64ToBuf(keyB64);
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']);
}
async function encryptTextWithKey(keyObj, plain){
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder().encode(plain);
    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keyObj, enc);
    return { cipherB64: bufToBase64(cipherBuf), ivB64: bufToBase64(iv) };
}
async function decryptTextWithKey(keyObj, cipherB64, ivB64){
    const cipher = base64ToBuf(cipherB64);
    const iv = base64ToBuf(ivB64);
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, keyObj, cipher);
    return new TextDecoder().decode(plainBuf);
}
/* --- end crypto helpers --- */

function buildUrlWith(paramsObj){
    const url = new URL(window.location.href);
    
    Object.keys(paramsObj).forEach(k => {
        if(paramsObj[k] == null) url.searchParams.delete(k);
        else url.searchParams.set(k, paramsObj[k]);
    });
    return url.toString();
}

function determineWinner(p1, p2){
    if(p1 === p2) return "Tie";
    if(
        (p1 === 'rock' && p2 === 'scissors') ||
        (p1 === 'paper' && p2 === 'rock') ||
        (p1 === 'scissors' && p2 === 'paper')
    ) return "Player 1 wins";
    return "Player 2 wins";
}

/* UI helpers */
const pickSection = document.getElementById('pick-section');
const shareArea = document.getElementById('share-area');
const shareLinkInput = document.getElementById('share-link');
const copyBtn = document.getElementById('copy-link');
const openBtn = document.getElementById('open-link');
const opponentSection = document.getElementById('opponent-section');
const opponentInstructions = document.getElementById('opponent-instructions');
const resultSection = document.getElementById('result-section');
const resultText = document.getElementById('result-text');
const player1ChoiceSpan = document.getElementById('player1-choice');
const player2ChoiceSpan = document.getElementById('player2-choice');
const playAgainBtn = document.getElementById('play-again');

/* Wire up initial choice buttons (for Player 1) */
document.querySelectorAll('.choice-button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
        const choice = btn.dataset.choice;
        startAsPlayer1(choice);
    });
});

/* Player 1 flow: create encrypted share link */
async function startAsPlayer1(choice){
    // generate AES key, encrypt the choice, put ciphertext in query, key in fragment
    try{
        const { key, keyB64 } = await generateAesKeyBase64();
        const { cipherB64, ivB64 } = await encryptTextWithKey(key, choice);

        // put cipher and iv in query params, key in fragment (not sent to server)
        const base = buildUrlWith({ d: cipherB64, iv: ivB64 });
        const full = `${base.split('#')[0].split('?')[0]}?d=${encodeURIComponent(cipherB64)}&iv=${encodeURIComponent(ivB64)}#k=${encodeURIComponent(keyB64)}`;

        shareLinkInput.value = full;
        shareArea.classList.remove('hidden');
        pickSection.querySelector('#pick-instructions').textContent = `You picked: ${choice}. Send the link to your friend.`;
    }catch(e){
        alert('Encryption failed. Try again in a modern browser.');
    }
}

/* Copy / Open actions */
copyBtn.addEventListener('click', async ()=>{
    try{
        await navigator.clipboard.writeText(shareLinkInput.value);
        copyBtn.textContent = 'Copied';
        setTimeout(()=> copyBtn.textContent = 'Copy link', 1200);
    }catch(e){
        alert('Copy failed. Select and copy the link manually.');
    }
});
openBtn.addEventListener('click', ()=>{
    window.open(shareLinkInput.value, '_blank');
});

/* Opponent buttons (Player 2) */
document.querySelectorAll('.choice-button-opponent').forEach(btn=>{
    btn.addEventListener('click', ()=>{
        const p2 = btn.dataset.choice;
        performPlayer2Pick(p2);
    });
});

async function performPlayer2Pick(p2choice){
    const params = getParams();
    const cipher = params.get('d');
    const iv = params.get('iv');
    const keyB64 = new URLSearchParams(window.location.hash.slice(1)).get('k');

    if(!cipher || !iv || !keyB64){
        alert('Invalid or missing encrypted Player 1 data in the link.');
        return;
    }

    try{
        const keyObj = await importAesKeyFromBase64(decodeURIComponent(keyB64));
        const p1 = await decryptTextWithKey(keyObj, decodeURIComponent(cipher), decodeURIComponent(iv));
        // update URL without reloading to include p2 (p2 kept plaintext)
        const newUrl = buildUrlWith({ d: cipher, iv: iv, p2: p2choice });
        // keep the fragment (key) intact
        const final = `${newUrl.split('#')[0]}#k=${encodeURIComponent(keyB64)}`;
        history.replaceState(null, '', final);
        showResult(p1, p2choice);
    }catch(e){
        alert('Failed to decrypt Player 1 choice. Link may be corrupted.');
    }
}

/* Show result UI */
function showResult(p1, p2){
    pickSection.classList.add('hidden');
    opponentSection.classList.add('hidden');
    resultSection.classList.remove('hidden');

    player1ChoiceSpan.textContent = `Player 1: ${p1}`;
    player2ChoiceSpan.textContent = `Player 2: ${p2}`;
    const verdict = determineWinner(p1, p2);
    resultText.textContent = `${verdict} — ${p1} vs ${p2}`;
}

playAgainBtn.addEventListener('click', ()=>{
    // reset to initial state by removing query params and fragment
    const clean = buildUrlWith({ d: null, iv: null, p2: null });
    history.replaceState(null, '', clean.split('#')[0]);
    location.reload();
});

/* On load: route based on params (decrypt p1 if encrypted) */
(async function initFromUrl(){
    const params = getParams();
    const cipher = params.get('d');
    const iv = params.get('iv');
    const p2 = sanitizeChoice(params.get('p2'));
    const keyB64 = new URLSearchParams(window.location.hash.slice(1)).get('k');

    if(cipher && iv && keyB64 && !p2){
        // Player 2 should open and pick; decrypt p1 to show who picked
        try{
            const keyObj = await importAesKeyFromBase64(decodeURIComponent(keyB64));
            const p1 = await decryptTextWithKey(keyObj, decodeURIComponent(cipher), decodeURIComponent(iv));
            pickSection.classList.add('hidden');
            opponentSection.classList.remove('hidden');
            opponentInstructions.textContent = `Player 1 already picked: ${p1}. Choose your move:`;
        }catch(e){
            // decryption failed
            pickSection.classList.add('hidden');
            opponentSection.classList.remove('hidden');
            opponentInstructions.textContent = `Player 1 pick is encrypted but could not be decrypted.`;
        }
    } else if(cipher && iv && keyB64 && p2){
        // both present (p1 encrypted, p2 plaintext) -> decrypt and show result
        try{
            const keyObj = await importAesKeyFromBase64(decodeURIComponent(keyB64));
            const p1 = await decryptTextWithKey(keyObj, decodeURIComponent(cipher), decodeURIComponent(iv));
            showResult(p1, p2);
        }catch(e){
            pickSection.classList.add('hidden');
            opponentSection.classList.remove('hidden');
            opponentInstructions.textContent = `Player 1 pick is encrypted but could not be decrypted.`;
        }
    } else {
        // default view: player 1 can pick and generate link
        shareArea.classList.add('hidden');
        opponentSection.classList.add('hidden');
        resultSection.classList.add('hidden');
        pickSection.classList.remove('hidden');
    }
})();