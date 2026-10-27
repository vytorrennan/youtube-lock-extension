const title = document.querySelector('#title');
const description = document.querySelector('#description');
const toggle = document.querySelector('#toggle');
const detail = document.querySelector('#detail');
let locked = false;
function render(state) {
  locked = state.locked;
  title.textContent = locked ? 'Your videos are locked in.' : 'Stick with what’s open.';
  description.textContent = locked ? 'You can refresh and keep watching the videos that were open when you locked.' : 'Lock your current YouTube video tabs and block new videos until you unlock.';
  toggle.textContent = locked ? 'Unlock videos' : 'Lock current videos';
  toggle.classList.toggle('secondary', locked);
  detail.textContent = locked ? `${state.count} video tab${state.count === 1 ? '' : 's'} allowed` : 'Your open video tabs will be saved when you lock.';
  toggle.disabled = false;
}
async function send(type) {
  const response = await chrome.runtime.sendMessage({ type });
  if (response.error) throw new Error(response.error);
  return response;
}
toggle.addEventListener('click', async () => {
  toggle.disabled = true;
  try { render(await send(locked ? 'unlock' : 'lock')); }
  catch (error) { detail.textContent = `Could not update lock: ${error.message}`; toggle.disabled = false; }
});
send('status').then(render).catch(error => { title.textContent = 'Something went wrong'; detail.textContent = error.message; });
