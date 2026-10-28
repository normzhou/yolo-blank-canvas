const $ = id => document.getElementById(id);
const notice = message => { $('notice').textContent = message; };
let account, forms, draft, selected, replyDraft;
const storage = {
  get(key) { try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; } },
  set(key,value) { try { sessionStorage.setItem(key,JSON.stringify(value)); } catch { notice('This browser cannot save drafts. Keep this page open until sending is confirmed.'); } }
};
const key = name => `yolo-feedback:${account}:${name}`;
const fresh = () => ({ id:crypto.randomUUID(), template:forms[0].id, input:{} });
const save = () => storage.set(key('draft'),draft);
async function api(path, body) {
  const headers = account ? {'X-Feedback-Owner':account} : {};
  if(body) headers['Content-Type']='application/json';
  const response = await fetch('/feedback/api/' + path, {headers, ...(body ? {method:'POST',body:JSON.stringify(body)} : {})});
  const data = await response.json(); if (!response.ok) { const error=new Error(data.error ?? 'Feedback unavailable.'); error.status=response.status; throw error; } return data;
}
function renderFields() {
  const form = forms.find(f => f.id === draft.template); $('fields').replaceChildren();
  for (const field of form.form.fields) {
    const label = document.createElement('label'); label.htmlFor = field.field; label.textContent = field.label;
    const input = document.createElement('textarea'); input.id = field.field; input.name = field.field; input.rows = 3;
    input.required = form.input_schema.required.includes(field.field); input.maxLength = form.input_schema.properties[field.field].maxLength;
    input.value = draft.input[field.field] ?? ''; input.disabled = !!draft.sent;
    input.addEventListener('input',() => { if (input.value) draft.input[field.field] = input.value; else delete draft.input[field.field]; save(); });
    const hint = document.createElement('p'); hint.className = 'hint'; hint.textContent = field.help;
    $('fields').append(label,input,hint);
  }
  $('type').disabled = !!draft.sent; $('send').disabled = !!draft.sent;
}
function message(text, who) {
  const box = document.createElement('div'); box.className = 'message';
  const label = document.createElement('strong'); label.textContent = who;
  const content = document.createElement('div'); content.textContent = text; box.append(label,content); return box;
}
async function list() {
  const data = await api('requests'); $('requests').replaceChildren();
  if (!data.requests.length) $('requests').textContent = 'Your feedback will appear here.';
  for (const item of data.requests) {
    const button = document.createElement('button'); button.type='button'; button.className='request';
    button.textContent = `${item.title}${item.preview ? ' · '+item.preview : ''} · ${item.phase === 'sent' ? 'Submitted' : item.phase === 'rejected' ? 'Not submitted' : 'Awaiting confirmation'}`;
    button.addEventListener('click',() => open(item.id).catch(error => notice(error.message))); $('requests').append(button);
  }
}
async function open(id) {
  let thread;
  try { thread=await api('requests/' + id); } catch(error) {
    if(error.status===404 && draft.id===id && draft.sent) { draft.sent=false; save(); renderFields(); notice('No saved submission was found. You can retry the same draft and request ID.'); return; }
    throw error;
  }
  selected = id;
  $('new-request').hidden=!(draft.id===id && thread.phase==='rejected');
  $('thread').hidden = false; $('thread-title').textContent = thread.title; $('messages').replaceChildren();
  $('thread-status').textContent = thread.status ? `Recorded issue state: ${thread.status.state}${thread.status.workflow.length ? ' · ' + thread.status.workflow.join(', ') : ''}. This alone does not verify delivery.` : 'Awaiting confirmation. Refresh to check; your submission will not be sent again.';
  for (const [name,value] of Object.entries(thread.input)) $('messages').append(message(value,name));
  for (const reply of thread.replies) $('messages').append(message(reply.message,reply.phase === 'sent' ? 'You' : `You · ${reply.phase === 'rejected' ? 'not sent' : 'awaiting confirmation'}`));
  for (const response of thread.responses) $('messages').append(message(response.message,'Response'));
  replyDraft = storage.get(key('reply:' + id)) ?? { id:crypto.randomUUID(), message:'' };
  const previous = thread.replies.find(r => r.id === replyDraft.id);
  $('new-reply').hidden=previous?.phase!=='rejected';
  if(replyDraft.sent && !previous){replyDraft.sent=false;storage.set(key('reply:' + id),replyDraft);}
  if (previous?.phase === 'sent') { replyDraft = { id:crypto.randomUUID(),message:'' }; storage.set(key('reply:' + id),replyDraft); }
  $('reply').value=replyDraft.message; $('reply-form').hidden = thread.phase !== 'sent';
  $('reply').disabled = !!replyDraft.sent; $('reply-form').querySelector('button').disabled = !!replyDraft.sent;
  if (draft.id === id && thread.phase === 'sent') { draft=fresh(); save(); $('type').value=draft.template; renderFields(); notice('Feedback submitted. You can add a reply below.'); }
  return thread;
}
$('new-request').addEventListener('click',()=>{draft={...draft,id:crypto.randomUUID(),sent:false};save();renderFields();$('new-request').hidden=true;notice('Your earlier submission was rejected. Review this saved draft before sending a new request.');});
$('new-reply').addEventListener('click',()=>{replyDraft={id:crypto.randomUUID(),message:replyDraft.message};storage.set(key('reply:' + selected),replyDraft);$('reply').disabled=false;$('reply-form').querySelector('button').disabled=false;$('new-reply').hidden=true;notice('Review your saved reply before sending it as a new operation.');});
$('type').addEventListener('change',() => { draft.template=$('type').value; draft.input={}; save(); renderFields(); });
$('request-form').addEventListener('submit',async event => {
  event.preventDefault(); if (draft.sent) return;
  // Persist the same operation ID before the network starts, including an unknown response.
  draft.sent=true; save(); renderFields(); notice('Sending…');
  try { const result=await api('requests',{id:draft.id,template:draft.template,input:draft.input}); const confirmed=await open(result.id); await list(); if (confirmed?.phase !== 'sent') notice('Awaiting confirmation. Keep your draft and refresh; it will not be sent again automatically.'); }
  catch(error) { notice(error.message + ' Your draft is retained. Refresh to check before trying another submission.'); }
});
$('reply').addEventListener('input',() => { replyDraft.message=$('reply').value; storage.set(key('reply:' + selected),replyDraft); });
$('reply-form').addEventListener('submit',async event => {
  event.preventDefault(); if (!replyDraft.message || replyDraft.sent) return;
  replyDraft.sent=true; storage.set(key('reply:' + selected),replyDraft); $('reply').disabled=true; $('reply-form').querySelector('button').disabled=true;
  try { const result=await api(`requests/${selected}/replies`,{id:replyDraft.id,message:replyDraft.message}); notice(result.phase === 'sent' ? 'Reply submitted.' : 'Reply awaiting confirmation. Refresh to check.'); await open(selected); }
  catch(error) { notice(error.message + ' Your reply is retained. Refresh to check its status.'); }
});
$('refresh').addEventListener('click',async()=>{
  try { if(selected) await open(selected); else if(draft.sent) await open(draft.id); await list(); }
  catch(error) { notice(error.message); }
});
try {
  const session=await api('session'); account=session.owner; forms=session.forms;
  draft=storage.get(key('draft')) ?? fresh(); if (!forms.some(f=>f.id===draft.template)) draft=fresh();
  for(const form of forms){const option=document.createElement('option'); option.value=form.id; option.textContent=form.title; $('type').append(option);}
  $('type').value=draft.template; renderFields(); $('composer').hidden=false; notice('Only your requests and replies intended for you appear here.');
  await list(); if(draft.sent) await open(draft.id);
} catch(error) { notice(error.message); }
