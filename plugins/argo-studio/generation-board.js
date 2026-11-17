(function (global) {
  'use strict';
  const terminal = new Set(['saved', 'completed', 'applied', 'failed', 'denied', 'cancelled', 'uncertain', 'needsReconciliation', 'interrupted', 'expired']);
  const clone = value => JSON.parse(JSON.stringify(value));
  function panelIcon(kind) {
    const namespace = 'http://www.w3.org/2000/svg', svg = document.createElementNS(namespace, 'svg'), path = document.createElementNS(namespace, 'path');
    svg.setAttribute('viewBox', kind === 'chevron' ? '0 0 12 12' : '0 0 16 16'); svg.setAttribute('class', 'panel-icon panel-icon-' + kind); svg.setAttribute('data-panel-icon', kind); svg.setAttribute('aria-hidden', 'true');
    path.setAttribute('d', kind === 'chevron' ? 'M3 4.5 6 7.5 9 4.5' : 'M3 8.5 6.5 12 13 3.5'); svg.append(path); return svg;
  }
  let openMenu = null, menuSequence = 0;
  const enhancedSelects = new WeakMap();
  function closeMenu(restoreFocus = false) {
    if (!openMenu) return;
    const { trigger, menu } = openMenu; openMenu = null;
    menu.remove(); trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus && trigger.isConnected) trigger.focus();
  }
  function positionMenu(menu, trigger) {
    const rect = trigger.getBoundingClientRect(), edge = 12, gap = 6;
    const width = Math.min(Math.max(rect.width, 164), Math.max(0, innerWidth - edge * 2));
    menu.style.width = width + 'px'; menu.style.maxHeight = '320px';
    const height = Math.min(menu.scrollHeight, 320), below = innerHeight - rect.bottom - edge - gap, above = rect.top - edge - gap;
    const downward = below >= Math.min(height, 160) || below >= above;
    menu.style.maxHeight = Math.max(0, Math.min(320, downward ? below : above)) + 'px';
    menu.style.left = Math.max(edge, Math.min(rect.left, innerWidth - width - edge)) + 'px';
    menu.style.top = (downward ? Math.max(edge, rect.bottom + gap) : Math.max(edge, rect.top - gap - Math.min(height, above))) + 'px';
  }
  function menuKeyboard(menu, event, close) {
    const items = [...menu.querySelectorAll('button:not(:disabled)')];
    if (!items.length) return;
    const index = items.indexOf(document.activeElement);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : Math.max(0, Math.min(items.length - 1, index + (event.key === 'ArrowUp' ? -1 : 1)));
      items[next].focus(); items[next].scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
    else if (event.key === 'Tab') close(true);
  }
  function enhanceSelects(root) {
    for (const source of root.querySelectorAll('select')) {
      if (enhancedSelects.has(source)) { enhancedSelects.get(source)(); continue; }
      const trigger = document.createElement('button'), title = document.createElement('span'), caret = panelIcon('chevron');
      trigger.type = 'button'; trigger.className = 'panel-select-trigger'; trigger.id = (source.id || 'panelSelect' + (++menuSequence)) + 'Trigger';
      trigger.setAttribute('role', 'combobox'); trigger.setAttribute('aria-haspopup', 'listbox'); trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-label', source.getAttribute('aria-label') || '选择'); trigger.dataset.field = source.dataset.field || '';
      caret.classList.add('panel-select-caret'); trigger.append(title, caret);
      source.dataset.menuSource = 'true'; source.setAttribute('aria-hidden', 'true'); source.tabIndex = -1; source.removeAttribute('aria-label'); source.after(trigger);
      const sync = () => { title.textContent = source.selectedOptions[0]?.textContent || '未选择'; trigger.disabled = source.disabled; if (trigger.disabled && openMenu?.trigger === trigger) closeMenu(); };
      const open = (direction = 0) => {
        if (source.disabled) return;
        if (openMenu?.trigger === trigger) { closeMenu(true); return; }
        closeMenu();
        const menu = document.createElement('div'); menu.className = 'panel-menu panel-select-menu'; menu.id = trigger.id + 'List'; menu.setAttribute('role', 'listbox'); menu.setAttribute('aria-label', trigger.getAttribute('aria-label'));
        for (const option of source.options) {
          const item = document.createElement('button'), label = document.createElement('span'), check = document.createElement('span');
          item.type = 'button'; item.setAttribute('role', 'option'); item.setAttribute('aria-selected', String(option.selected)); item.disabled = option.disabled; item.tabIndex = -1;
          label.textContent = option.textContent; check.className = 'panel-menu-check'; check.append(panelIcon('check')); check.setAttribute('aria-hidden', 'true'); item.append(label, check);
          item.onclick = () => { const changed = source.value !== option.value; source.value = option.value; sync(); closeMenu(true); if (changed) source.dispatchEvent(new Event('change', { bubbles: true })); };
          menu.append(item);
        }
        menu.onkeydown = event => menuKeyboard(menu, event, closeMenu); document.body.append(menu);
        openMenu = { trigger, menu }; trigger.setAttribute('aria-controls', menu.id); trigger.setAttribute('aria-expanded', 'true'); positionMenu(menu, trigger);
        const items = [...menu.querySelectorAll('button:not(:disabled)')], selected = items.findIndex(item => item.getAttribute('aria-selected') === 'true');
        const index = direction === -2 ? items.length - 1 : direction === 2 ? 0 : selected < 0 ? (direction < 0 ? items.length - 1 : 0) : selected;
        items[index]?.focus(); items[index]?.scrollIntoView({ block: 'nearest' });
      };
      trigger.onclick = () => open();
      trigger.onkeydown = event => { if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); open(event.key === 'Home' ? 2 : event.key === 'End' ? -2 : event.key === 'ArrowUp' ? -1 : 1); } };
      source.addEventListener('change', sync); new MutationObserver(sync).observe(source, { attributes: true, childList: true, subtree: true }); enhancedSelects.set(source, sync); sync();
    }
  }
  document.addEventListener('pointerdown', event => { if (openMenu && !openMenu.menu.contains(event.target) && !openMenu.trigger.contains(event.target)) closeMenu(); }, true);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && openMenu) { event.preventDefault(); event.stopImmediatePropagation(); closeMenu(true); } }, true);
  document.addEventListener('scroll', event => { if (openMenu && !openMenu.menu.contains(event.target)) closeMenu(); }, true);
  global.addEventListener('resize', () => { if (openMenu) positionMenu(openMenu.menu, openMenu.trigger); });
  global.ArgoPanelMenus = { enhance: enhanceSelects, close: closeMenu, keyboard: menuKeyboard, position: positionMenu, icon: panelIcon };
  const style = `
    [hidden]{display:none!important}
    .panel-icon{display:block;fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round}.panel-icon-chevron{width:12px;height:12px;stroke-width:1.5}.panel-icon-check{width:16px;height:16px;stroke-width:1.25}
    #generationBoard{display:flex;flex:1;flex-direction:column;min-height:0;font:inherit;color:var(--text)}#generationBoard[hidden]{display:none}
    select,textarea{font:inherit;color:var(--text);background:var(--raised);border:1px solid var(--line);border-radius:var(--panel-control-radius,8px);min-width:0}
    select:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
    .gb-toolbar{display:grid;grid-template-columns:var(--panel-label-width,76px) minmax(0,1fr);align-items:center;gap:var(--panel-space-3,12px);padding:var(--panel-space-4,16px) var(--panel-inset,16px) var(--panel-space-3,12px);flex:none}
    .gb-scope-label{font-size:var(--panel-label-size,12px);font-weight:550}.gb-select{display:inline-flex;align-items:center;width:100%;min-width:0;max-width:100%;height:var(--panel-control-height,32px);border:1px solid var(--line);border-radius:var(--panel-control-radius,8px);background:var(--raised)}
    .gb-select select{width:100%;max-width:100%;border:0;background:transparent}.gb-select:has(.panel-select-trigger:focus-visible){outline:2px solid var(--accent);outline-offset:2px}.gb-select .panel-select-trigger:focus-visible{outline:none}
    .gb-content{flex:1;min-height:0;overflow:auto;overflow-x:hidden;padding:0 var(--panel-inset,16px) var(--panel-space-4,16px);scrollbar-width:none}.gb-content::-webkit-scrollbar{display:none}
    .gb-status{font-size:12px;line-height:1.5;color:var(--muted);white-space:pre-wrap;margin:0 0 var(--panel-space-3,12px)}.gb-status:empty{display:none}.gb-status.error{color:var(--danger)}
    .gb-form{min-width:0}.gb-parameters{display:grid;gap:var(--panel-space-3,12px);background:transparent;padding:0}.gb-parameters h2{margin:0;font-size:13px;line-height:20px;font-weight:650}
    .gb-field{display:grid;grid-template-columns:var(--panel-label-width,76px) minmax(0,1fr);align-items:center;gap:var(--panel-space-3,12px);min-width:0;min-height:var(--panel-control-height,32px)}
    .gb-label{font-size:var(--panel-label-size,12px);font-weight:550;line-height:1.5}.gb-control{min-width:0;font-size:13px}.gb-control small{display:block;color:var(--muted);font-size:11px;line-height:1.4;margin-top:var(--panel-space-1,4px)}
    .gb-duration{display:flex;align-items:center;gap:var(--panel-space-2,8px);min-width:0;height:var(--panel-control-height,32px)}.gb-duration input[type=range]{min-width:0;width:100%;flex:1;accent-color:var(--text);height:20px;margin:0}
    .gb-duration-number{display:flex;align-items:center;gap:var(--panel-space-1,4px);flex:none}.gb-duration input[type=number]{width:48px;min-width:0;height:var(--panel-control-height,32px);min-height:var(--panel-control-height,32px);padding:4px 6px;border:1px solid var(--line);border-radius:var(--panel-control-radius,8px);text-align:right;background:var(--bg);font-size:13px;appearance:textfield}.gb-duration input::-webkit-inner-spin-button{appearance:none}.gb-duration-unit{font-size:12px;color:var(--muted)}
    .gb-lanes{display:flex;gap:var(--panel-space-1,4px)}.gb-lanes button,.gb-prompt-source button{flex:1;min-width:0;height:var(--panel-control-height,32px);min-height:var(--panel-control-height,32px);padding:4px var(--panel-space-2,8px);font:inherit;font-size:13px;border:1px solid var(--line);background:var(--bg);color:var(--muted);border-radius:var(--panel-control-radius,8px)}
    .gb-lanes button[aria-pressed=true],.gb-prompt-source button[aria-pressed=true]{border-color:var(--accent);color:#fff;background:var(--accent)}
    .gb-prompt{margin-top:var(--panel-space-4,16px);border-top:1px solid var(--line);font-size:12px}.gb-prompt>summary{padding:var(--panel-space-3,12px) 0;line-height:16px;color:var(--muted);cursor:pointer}
    .gb-prompt-head{margin-bottom:var(--panel-space-2,8px)}.gb-prompt-source{display:flex;gap:var(--panel-space-2,8px);width:100%}
    select[data-menu-source]{display:none!important}
    .panel-select-trigger{display:flex;align-items:center;justify-content:space-between;gap:var(--panel-space-2,8px);width:100%;min-width:0;height:calc(var(--panel-control-height,32px) - 2px);min-height:calc(var(--panel-control-height,32px) - 2px);padding:0 var(--panel-control-inline,10px);border:0;border-radius:inherit;background:transparent;font:inherit;font-size:13px;color:var(--text);text-align:left}
    .panel-select-trigger>span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.panel-select-caret{flex:none;color:var(--muted)}
    .panel-menu{position:fixed;z-index:40;min-width:0;padding:var(--panel-menu-inset,4px);border:1px solid var(--line);border-radius:var(--panel-menu-radius,15px);background:var(--bg);box-shadow:0 5px 22px #0002;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none}
    .panel-menu::-webkit-scrollbar{display:none}.panel-menu button{display:flex;align-items:center;justify-content:space-between;gap:var(--panel-space-4,16px);width:100%;min-height:var(--panel-menu-row-height,36px);padding:var(--panel-space-2,8px) var(--panel-space-3,12px);border:0;border-radius:var(--panel-menu-row-radius,10px);background:transparent;color:var(--text);text-align:left;font:inherit;font-size:13px;font-weight:400;overflow-wrap:anywhere}
    .panel-menu button>span:first-child{min-width:0}.panel-menu button:hover,.panel-menu button:focus-visible{background:var(--raised);filter:none;outline:none}.panel-menu button:disabled{opacity:.4;cursor:default}.panel-menu button:disabled:hover{background:transparent}
    .panel-menu-check{flex:none;font-size:16px;line-height:1;color:var(--muted);visibility:hidden}.panel-menu [aria-selected=true] .panel-menu-check{visibility:visible}
    .gb-prompt textarea{display:block;resize:vertical;min-height:116px;max-height:none;width:100%;padding:var(--panel-space-3,12px);line-height:1.55;font-size:12px}
    .gb-footer{flex-wrap:wrap}.gb-footer .gb-quote{flex-basis:100%;font-size:11px;color:var(--muted);line-height:1.4;text-align:right}.gb-quote:empty{display:none}#gbGenerate{margin-left:auto}
    .gb-empty{padding:var(--panel-space-4,16px) 0;color:var(--muted);font-size:12px;text-align:center}
    @media(max-width:270px){.gb-toolbar,.gb-field{grid-template-columns:64px minmax(0,1fr);gap:var(--panel-space-2,8px)}.gb-toolbar,.gb-content{padding-left:10px;padding-right:10px}.gb-duration{gap:4px}.gb-duration input[type=number]{width:38px}}
  `;
  function mount(root, bridge) {
    const sheet = document.createElement('style'); sheet.textContent = style; root.append(sheet);
    const content = document.createElement('div');
    content.innerHTML = '<div class="gb-toolbar"><label class="gb-scope-label" for="gbTargetTrigger">范围</label><span class="gb-select gb-target"><select id="gbTarget" aria-label="生成范围"></select></span></div><main class="gb-content"><div id="gbStatus" class="gb-status" role="status" aria-live="polite"></div><div id="gbForm" class="gb-form"></div></main><footer class="panel-footer gb-footer"><span id="gbQuote" class="gb-quote" aria-live="polite"></span><button id="gbApply" disabled>覆盖参数</button><button id="gbGenerate" class="primary" disabled>生成候选</button></footer>';
    // Keep the scrolling region and footer as direct flex children.
    root.append(...content.childNodes);
    const $ = id => root.querySelector('#' + id);
    let active = false, busy = false, loading = false, epoch = 0, target = '', project = '', proposals = [], targets = [];
    let refreshTimer, activeUntil = Date.now() + 30000;
    let refreshFlight = null, refreshRequested = false, forceRefreshRequested = false;
    let state = null, preparation = null, selectedProposal = null, quote = null, dirty = false, optionTimer, quoteTimer;
    let touched = new Set(), parameterTouched = new Set();
    const retainedDrafts = new Map(), staleProposals = new Set(), maximumSnapshotPages = 64;
    let preferredProposalID = null;
    let discoveryProject = null, discoveryReady = false, discoveryInFlight = false, prefetchedProposals = null;
    const seenProposals = new Map();
    const drafts = new Map(), savedBaselines = new Map(), pendingSaves = new Map(), invalidatedSavedRevisions = new Map();
    let snapshotRevision = null, promptExpanded = false, promptResizeObserver = null, promptEditorHeight = 0;
    function rememberDraft() {
      if (!dirty || !preparation || !state || snapshotRevision == null) return;
      drafts.set(target, { preparation: clone(preparation), state: clone(state), touched: [...touched], parameterTouched: [...parameterTouched], revision: snapshotRevision, proposal: selectedProposal });
    }
    function retainDraft(id, value) {
      if (!value) return;
      retainedDrafts.set(id + '|' + value.revision, value);
      while (retainedDrafts.size > 64) retainedDrafts.delete(retainedDrafts.keys().next().value);
      drafts.delete(id);
    }
    const status = (text, error = false) => { $('gbStatus').textContent = text || ''; $('gbStatus').classList.toggle('error', error); };
    async function invoke(tool, args = {}) {
      let result = bridge.payload(await bridge.tool('argo_workshop', { tool, arguments: args }));
      const operation = result.operationRef;
      const deadline = Date.now() + 1800000;
      let statusChecked = false;
      while (operation && !terminal.has(result.status)) {
        if (Date.now() >= deadline) throw Error('操作确认已到期，请核对原操作。');
        if (statusChecked) {
          await new Promise(resolve => setTimeout(resolve, 350));
          if (Date.now() >= deadline) throw Error('操作确认已到期，请核对原操作。');
        }
        result = bridge.payload(await bridge.tool('argo_operation_status', { operationRef: operation }));
        statusChecked = true;
      }
      if (operation && !['completed', 'saved', 'applied'].includes(result.status)) throw Error(result.summary || '操作未完成。');
      return { data: operation ? result.result || {} : result, projectRef: result.projectRef, operation: operation ? result : null };
    }
    const read = async (tool, args) => (await invoke(tool, args)).data;
    async function readProposalSnapshot() {
      const response = await invoke('generation.proposalRead', { offset: 0, limit: 50 });
      const values = [...(response.data.proposals || [])], offsets = new Set();
      let offset = response.data.nextOffset;
      while (Number.isSafeInteger(offset)) {
        if (offsets.has(offset)) throw Error('提案分页已变化，请刷新。'); offsets.add(offset);
        const page = await read('generation.proposalRead', { offset, limit: 50 });
        values.push(...(page.proposals || [])); offset = page.nextOffset;
      }
      return { ...response, data: { ...response.data, proposals: values } };
    }
    function rememberProposals(response) {
      const projectChanged = discoveryProject !== response.projectRef;
      if (projectChanged) { seenProposals.clear(); discoveryReady = false; }
      discoveryProject = response.projectRef;
      for (const value of response.data.proposals || []) seenProposals.set(value.proposalID, value.proposalRevision);
      while (seenProposals.size > 256) seenProposals.delete(seenProposals.keys().next().value);
      discoveryReady = true;
    }
    async function observeProposals() {
      if (active || busy || loading || discoveryInFlight) return;
      discoveryInFlight = true;
      const ticket = epoch;
      try {
        const response = await readProposalSnapshot();
        if (ticket !== epoch || active) return;
        const sameProject = discoveryProject === response.projectRef;
        const next = discoveryReady && sameProject ? response.data.proposals.find(value =>
          value.state === 'proposed' && !proposalExpired(value) && seenProposals.get(value.proposalID) !== value.proposalRevision) : null;
        rememberProposals(response);
        if (!next) return;
        preferredProposalID = next.proposalID; prefetchedProposals = response;
        bridge.show?.();
      } catch {
        // Discovery is an optional read beside the existing asset refresh.
        // Failure must not retire valid asset cards, selection, or playback.
      } finally { discoveryInFlight = false; }
    }
    function revisionOf(value) {
      if (!Number.isSafeInteger(value?.workspaceRevision) || value.workspaceRevision < 0) throw Error('宿主未提供有效工作区版本，未采用这次读取。');
      return value.workspaceRevision;
    }
    function changedSnapshot() { const error = Error('工坊在读取期间发生变化，请稍后刷新。'); error.snapshotChanged = true; return error; }
    function requireRevision(value, revision) { if (revisionOf(value) !== revision) throw changedSnapshot(); }
    async function readOptions(tool, args) {
      const result = await read(tool, { ...args, offset: 0, limit: 50 });
      const revision = revisionOf(result);
      if (!result.options) throw Error('宿主未返回型号选项。');
      let offset = result.options?.nextOffset;
      const seen = new Set();
      while (Number.isSafeInteger(offset)) {
        if (seen.has(offset) || seen.size >= maximumSnapshotPages) throw Error('型号分页未能有界完成，请刷新。'); seen.add(offset);
        const page = await read(tool, { ...args, offset, limit: 50 });
        requireRevision(page, revision); if (!page.options) throw Error('宿主未返回型号选项。');
        result.options.models.push(...(page.options.models || [])); offset = page.options.nextOffset;
      }
      return result;
    }
    async function readReferences(id) {
      const result = await read('generation.workspace', { shotID: id, part: 'references', offset: 0, limit: 50 }), revision = revisionOf(result), seen = new Set();
      if (!result.references) throw Error('宿主未返回参考信息。');
      let offset = result.references.nextOffset;
      while (Number.isSafeInteger(offset)) {
        if (seen.has(offset) || seen.size >= maximumSnapshotPages) throw Error('参考分页未能有界完成，请刷新。'); seen.add(offset);
        const page = await read('generation.workspace', { shotID: id, part: 'references', offset, limit: 50 }); requireRevision(page, revision);
        if (!page.references) throw Error('宿主未返回参考信息。');
        result.references.items.push(...(page.references.items || [])); offset = page.references.nextOffset;
      }
      return result;
    }
    function hasLocalEdits(id) {
      const revision = preparation?.shotID === id ? snapshotRevision : targets.find(value => value.shotID === id)?.workspaceRevision;
      return preparation?.shotID === id && dirty || drafts.get(id)?.revision === revision && !!drafts.get(id)?.touched.length;
    }
    function nativePreparation(id, inspection, references, options, prompt) {
      const value = { shotID: id, expectedRevision: revisionOf(inspection), ...clone(inspection.draftSettings || {}),
        prompt: prompt?.customPrompt || '', directorPrompt: prompt?.directorPrompt || '', promptSource: prompt?.source || 'custom',
        referenceIDs: (references.references.items || []).filter(value => value.selected).map(value => value.id) };
      value.candidateLanes = value.selectedCandidateLanes || value.candidateLanes || []; delete value.selectedCandidateLanes; delete value.candidateCount;
      if (options.options.savedModelParameters && typeof options.options.savedModelParameters === 'object') value.modelParameters = clone(options.options.savedModelParameters);
      return value;
    }
    function normalizePreparation(value) {
      if (!value.modelID) { delete value.modelID; value.clearModel = true; }
      if (value.referenceMode === 'omni') { delete value.startReferenceID; delete value.endReferenceID; delete value.ordinaryReferenceIDs; }
      else { for (const key of ['startReferenceID', 'endReferenceID']) if (!value[key]) delete value[key]; if (value.referenceMode === 'frames') delete value.ordinaryReferenceIDs; }
      return value;
    }
    async function readSnapshot(id, proposal = null, cached = null) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const parts = await Promise.allSettled([read('generation.workspace', { shotID: id, part: 'summary' }), read('generation.inspect', { shotID: id }), readReferences(id), readOptions('generation.workspace', { shotID: id, part: 'options' }), read('generation.workspace', { shotID: id, part: 'prompt' }), read('generation.businessStatus', { shotID: id })]);
          for (const part of parts) if (part.status === 'rejected') throw part.reason;
          const [start, inspection, references, options, promptPart, businessStatus] = parts.map(part => part.value);
          const revision = revisionOf(start);
          for (const part of [inspection, references, options, promptPart, businessStatus]) requireRevision(part, revision);
          const currentProposal = proposal && proposal.state === 'proposed' && !proposalExpired(proposal) && !staleProposals.has(proposal.proposalID) && proposal.preparation?.shotID === id && proposal.preparation?.expectedRevision === revision && proposal.workspaceRevision === revision ? proposal : null;
          const currentCache = cached?.revision === revision && cached.preparation.shotID === id ? cached : null;
          let value = nativePreparation(id, inspection, references, options, promptPart.prompt);
          if (currentProposal) value = { ...value, ...clone(currentProposal.settings), ...clone(currentProposal.preparation),
            prompt: currentProposal.prompt.customPrompt,
            directorPrompt: currentProposal.prompt.directorPrompt,
            promptSource: currentProposal.prompt.source,
            referenceIDs: (currentProposal.references || []).map(value => value.id) };
          if (currentCache) value = clone(currentCache.preparation);
          value.expectedRevision = revision; normalizePreparation(value);
          let projectedOptions = options;
          if (currentProposal || currentCache) {
            projectedOptions = await readOptions('generation.previewOptions', { preparation: patchFor(value, currentProposal, new Set(currentCache?.touched || []), new Set(currentCache?.parameterTouched || []), options.options) });
            requireRevision(projectedOptions, revision);
            if (projectedOptions.options.savedModelParameters) value.modelParameters = clone(projectedOptions.options.savedModelParameters);
          }
          const end = await read('generation.workspace', { shotID: id, part: 'summary' }); requireRevision(end, revision);
          return { preparation: value, state: { summary: end.summary, references: references.references, options: projectedOptions.options, businessStatus }, inspection, revision, proposal: currentProposal, cache: currentCache };
        } catch (error) { if (!error.snapshotChanged || attempt === 1) throw error; }
      }
    }
    function proposalExpired(value) { const time = Date.parse(value?.expiresAt); return !Number.isFinite(time) || time <= Date.now(); }
    function workspaceSaved(summary) { return summary?.saveState === 'saved' && summary.canSave === false; }
    function needsOverwrite() { return invalidatedSavedRevisions.get(target) === snapshotRevision; }
    function observeSaveState(summary, revision) {
      if (workspaceSaved(summary)) return;
      savedBaselines.delete(target); invalidatedSavedRevisions.set(target, revision); invalidateQuote();
    }
    function unconfirmedSave(summary) { return summary?.saveReason ? '工坊保存尚未确认：' + summary.saveReason : '工坊参数尚未确认保存，请核对后再次覆盖。'; }
    function providerTitle() {
      const id = preparation?.providerID || state?.options?.providerID;
      return id && state?.businessStatus?.platformID === id && state.businessStatus.platformName || id || '未配置';
    }
    function savedBaseline() { const value = savedBaselines.get(target); return workspaceSaved(state?.summary) && !needsOverwrite() && value?.workspaceRevision === snapshotRevision && value.savedReceiptID ? value : null; }
    function quoteValid() { return quote && quote.target === target && quote.workspaceRevision === snapshotRevision && !dirty && quote.expiresAt > Date.now() && savedBaseline(); }
    function formReady() { return preparation && state?.summary?.writable && !$('gbForm').querySelector('input:invalid,textarea:invalid'); }
    function canApply() { return formReady() && (pendingSaves.has(target) || (dirty || needsOverwrite() || state.summary.canSave === true || selectedProposal?.state === 'proposed') && (!selectedProposal || selectedProposal.state === 'proposed' && !proposalExpired(selectedProposal))); }
    function canGenerate() { return formReady() && !needsOverwrite() && !!preparation.candidateLanes?.length && (canApply() || !!savedBaseline() && !dirty); }
    function buttons() {
      $('gbForm').querySelectorAll('button:not(.panel-select-trigger),input,select,textarea').forEach(element => { element.disabled = busy || loading || element.dataset.unavailable === 'true'; });
      $('gbApply').disabled = busy || loading || !canApply();
      $('gbGenerate').disabled = busy || loading || !canGenerate();
      $('gbTarget').disabled = busy;
      enhanceSelects(root);
      $('gbQuote').textContent = quoteValid() ? `${quote.amount} ${quote.unit}` : quote ? '报价已失效' : '';
    }
    function invalidateQuote() { quote = null; clearTimeout(quoteTimer); }
    function changed() {
      dirty = true; invalidateQuote();
      status(''); buttons();
    }
    function field(title, node, reason = '') {
      const row = document.createElement('label'); row.className = 'gb-field';
      const label = document.createElement('span'); label.className = 'gb-label'; label.textContent = title;
      const control = document.createElement('span'); control.className = 'gb-control'; control.append(node);
      if (reason) { const hint = document.createElement('small'); hint.textContent = reason; control.append(hint); }
      if (node.dataset.field) row.dataset.field = node.dataset.field;
      row.append(label, control); ($('gbParameters') || $('gbForm')).append(row); return row;
    }
    function select(title, key, values, current, enabled = true, reason = '', onChange) {
      const node = document.createElement('select'); node.dataset.field = key; node.setAttribute('aria-label', title);
      const rows = values.map(value => typeof value === 'object' ? value : { value: String(value), title: String(value) });
      if (current !== undefined && current !== null && !rows.some(value => String(value.value) === String(current))) rows.unshift({ value: String(current), title: String(current) || '空值', disabled: true });
      for (const value of rows) { const option = new Option(value.title, value.value); option.disabled = !!value.disabled; node.append(option); }
      if (current == null) node.selectedIndex = -1; else node.value = String(current);
      node.dataset.unavailable = String(!enabled || !rows.length); node.disabled = node.dataset.unavailable === 'true';
      node.onchange = () => { onChange ? onChange(node.value) : preparation[key] = node.value; touched.add(key.startsWith('parameter:') ? 'modelParameters' : key); if (key.startsWith('parameter:')) { parameterTouched.add(key.slice('parameter:'.length)); touched.add('clearModelParameters'); } changed(); };
      const wrapper = document.createElement('span'); wrapper.className = 'gb-select'; wrapper.dataset.field = key; wrapper.append(node);
      field(title, wrapper, reason); return node;
    }
    function scheduleOptions() {
      clearTimeout(optionTimer); const ticket = epoch;
      optionTimer = setTimeout(async () => {
        try { const result = await readOptions('generation.previewOptions', { preparation: preparationPatch() }); requireRevision(result, snapshotRevision);
          const end = await read('generation.workspace', { shotID: target, part: 'summary' }); requireRevision(end, snapshotRevision);
          if (ticket !== epoch) return; state.options = result.options; state.summary = end.summary; observeSaveState(end.summary, snapshotRevision);
          if (result.options.savedModelParameters) preparation.modelParameters = clone(result.options.savedModelParameters);
          render();
        } catch (error) { if (ticket === epoch) { if (error.snapshotChanged) await loadTarget(target, null, true); else status(error.message, true); } }
      }, 150);
    }
    function render() {
      promptResizeObserver?.disconnect(); promptResizeObserver = null;
      if (openMenu && root.contains(openMenu.trigger)) closeMenu();
      const form = $('gbForm'); form.replaceChildren();
      if (!preparation || !state) { const empty = document.createElement('div'); empty.className = 'gb-empty'; empty.textContent = targets.length ? '正在读取参数…' : '当前没有可用生成范围'; form.append(empty); buttons(); return; }
      const options = state.options || {}, controls = options.controls || {};
      const parameters = document.createElement('section'); parameters.id = 'gbParameters'; parameters.className = 'gb-parameters';
      const heading = document.createElement('h2'); heading.textContent = '生成参数'; parameters.append(heading); form.append(parameters);
      const provider = document.createElement('span'); provider.id = 'gbProvider'; provider.textContent = providerTitle(); field('Provider', provider);
      const modes = { omni: '全能参考', frames: '首尾帧', mixed: '混合参考' };
      select('参考方式', 'referenceMode', (options.referenceModes || []).map(value => ({ value, title: modes[value] || value })), preparation.referenceMode, controls.referenceMode?.enabled, controls.referenceMode?.reason, value => {
        preparation.referenceMode = value; if (value === 'omni') { delete preparation.startReferenceID; delete preparation.endReferenceID; delete preparation.ordinaryReferenceIDs; } else if (value === 'frames') delete preparation.ordinaryReferenceIDs; else preparation.ordinaryReferenceIDs ||= [];
        for (const key of ['startReferenceID', 'endReferenceID', 'ordinaryReferenceIDs']) touched.add(key);
        render(); scheduleOptions();
      });
      select('Model', 'modelID', [{ value: '', title: '选择 Model' }, ...(options.models || []).map(value => ({ value: value.id, title: value.title, disabled: !value.selectable }))], preparation.modelID || '', controls.model?.enabled, controls.model?.reason, value => { if (value) { preparation.modelID = value; delete preparation.clearModel; } else { delete preparation.modelID; preparation.clearModel = true; } parameterTouched.clear(); touched.delete('modelParameters'); touched.delete('clearModelParameters'); delete preparation.clearModelParameters; preparation.modelParameters = {}; scheduleOptions(); });
      for (const parameter of options.parameters || []) {
        select(parameter.title, 'parameter:' + parameter.id, (parameter.values || []).map(value => ({ value, title: value === 'true' ? '开启' : value === 'false' ? '关闭' : value === '' ? '空值' : value })), preparation.modelParameters?.[parameter.id] ?? parameter.selectedValue ?? parameter.defaultValue, parameter.enabled, parameter.reason, value => {
          preparation.modelParameters ||= {};
          preparation.modelParameters[parameter.id] = value; preparation.clearModelParameters = (preparation.clearModelParameters || []).filter(key => key !== parameter.id);
          scheduleOptions();
        });
      }
      select('画面比例', 'aspectRatio', options.aspectRatios || [], preparation.aspectRatio, !!controls.aspectRatio?.enabled, controls.aspectRatio?.reason);
      select('分辨率', 'resolution', options.resolutions || [], preparation.resolution, !!controls.resolution?.enabled, controls.resolution?.reason);
      {
      const duration = document.createElement('input'); duration.type = 'number'; duration.step = '1'; duration.required = true; duration.inputMode = 'numeric'; duration.dataset.field = 'durationSeconds'; duration.setAttribute('aria-label', '时长（秒）'); duration.value = preparation.durationSeconds ?? '';
      const durations = [...new Set((options.durationSeconds || []).filter(Number.isSafeInteger))].sort((a, b) => a - b); if (durations.length) { duration.min = Math.min(...durations); duration.max = Math.max(...durations); }
      let durationDragging = false;
      const slider = document.createElement('input'); slider.type = 'range'; slider.min = '0'; slider.max = String(Math.max(0, durations.length - 1)); slider.step = 'any'; slider.value = String(Math.max(0, durations.indexOf(preparation.durationSeconds))); slider.setAttribute('aria-label', '时长滑条'); slider.setAttribute('aria-valuetext', String(preparation.durationSeconds ?? '') + ' 秒');
      duration.dataset.unavailable = slider.dataset.unavailable = String(!controls.duration?.enabled || !durations.length);
      function setDuration(value, report = false, syncSlider = true) {
        if (!Number.isSafeInteger(value) || !durations.includes(value)) { duration.setCustomValidity('请选择当前型号支持的整数秒。'); if (report) duration.reportValidity(); buttons(); return; }
        const updated = preparation.durationSeconds !== value;
        duration.setCustomValidity(''); duration.value = String(value); if (syncSlider) slider.value = String(durations.indexOf(value)); slider.setAttribute('aria-valuetext', value + ' 秒');
        if (!updated) { buttons(); return; }
        preparation.durationSeconds = value; touched.add('durationSeconds'); changed();
      }
      duration.oninput = () => { duration.setCustomValidity(''); buttons(); }; duration.onchange = () => setDuration(Number(duration.value), true);
      slider.onpointerdown = () => { durationDragging = true; };
      slider.onpointerup = slider.onpointercancel = slider.onblur = () => { durationDragging = false; slider.value = String(Math.max(0, durations.indexOf(preparation.durationSeconds))); };
      slider.oninput = () => { const index = Math.max(0, Math.min(durations.length - 1, Math.round(Number(slider.value)))), value = durations[index]; if (value !== preparation.durationSeconds || duration.value !== String(value) || !duration.validity.valid) setDuration(value, false, !durationDragging); else if (!durationDragging) slider.value = String(index); };
      const durationControl = document.createElement('span'); durationControl.className = 'gb-duration'; const durationNumber = document.createElement('span'); durationNumber.className = 'gb-duration-number'; const durationUnit = document.createElement('span'); durationUnit.className = 'gb-duration-unit'; durationUnit.textContent = 's'; durationNumber.append(duration, durationUnit); durationControl.append(slider, durationNumber);
      field('时长', durationControl, controls.duration?.reason);
      }
      const lanes = document.createElement('div'); lanes.className = 'gb-lanes'; lanes.setAttribute('role', 'group'); lanes.setAttribute('aria-label', '生成候选');
      for (const value of options.candidateLanes || []) { const button = document.createElement('button'); button.type = 'button'; button.textContent = value; button.setAttribute('aria-pressed', String((preparation.candidateLanes || []).includes(value))); button.dataset.unavailable = String(!controls.candidateLanes?.enabled); button.onclick = () => { const selected = new Set(preparation.candidateLanes || []); selected.has(value) ? selected.delete(value) : selected.add(value); preparation.candidateLanes = (options.candidateLanes || []).filter(lane => selected.has(lane)); delete preparation.candidateCount; touched.add('candidateLanes'); changed(); render(); }; lanes.append(button); }
      field('候选', lanes, controls.candidateLanes?.reason);
      const refs = state.references?.items || [], roleChoices = [{ value: '', title: '无' }, ...refs.filter(value => (preparation.referenceIDs || []).includes(value.id)).map(value => ({ value: value.id, title: value.name }))];
      if (preparation.referenceMode !== 'omni') {
        for (const [key, title, support] of [['startReferenceID', '首帧', 'supportsStart'], ['endReferenceID', '尾帧', 'supportsEnd']]) select(title, key, roleChoices, preparation[key] || '', !!state.references?.[support], '', value => { if (value) preparation[key] = value; else delete preparation[key]; if (preparation.referenceMode === 'mixed') { preparation.ordinaryReferenceIDs = (preparation.ordinaryReferenceIDs || []).filter(id => id !== preparation.startReferenceID && id !== preparation.endReferenceID); touched.add('ordinaryReferenceIDs'); } });
      }
      const prompt = document.createElement('details'); prompt.className = 'gb-prompt'; prompt.open = promptExpanded; prompt.ontoggle = () => { promptExpanded = prompt.open; }; const summary = document.createElement('summary'); summary.textContent = '提示词'; prompt.append(summary); const head = document.createElement('div'); head.className = 'gb-prompt-head';
      const source = document.createElement('div'); source.className = 'gb-prompt-source'; source.setAttribute('role', 'group'); source.setAttribute('aria-label', '提示词来源');
      for (const [value, title] of [['director', '导演稿'], ['custom', '自定义']]) {
        const button = document.createElement('button'); button.type = 'button'; button.dataset.promptSource = value; button.textContent = title; button.setAttribute('aria-pressed', String((preparation.promptSource || 'custom') === value));
        button.onclick = () => { if (preparation.promptSource === value) return; preparation.promptSource = value; touched.add('promptSource'); changed(); render(); }; source.append(button);
      }
      head.append(source); const editor = document.createElement('textarea'); editor.setAttribute('aria-label', '生成提示词'); const promptKey = preparation.promptSource === 'director' ? 'directorPrompt' : 'prompt'; editor.value = preparation[promptKey] || ''; if (promptEditorHeight) editor.style.height = promptEditorHeight + 'px'; editor.oninput = () => { preparation[promptKey] = editor.value; touched.add(promptKey); changed(); }; prompt.append(head, editor); form.append(prompt); buttons();
      if (typeof ResizeObserver !== 'undefined') {
        let previousHeight = editor.getBoundingClientRect().height;
        promptResizeObserver = new ResizeObserver(() => { const rect = editor.getBoundingClientRect(), grew = rect.height > previousHeight + .5; previousHeight = rect.height; if (!rect.height) return; promptEditorHeight = rect.height; if (grew && document.activeElement === editor) { const scroll = root.querySelector('.gb-content'), bounds = scroll.getBoundingClientRect(); if (rect.bottom > bounds.bottom - 12) scroll.scrollTop += rect.bottom - bounds.bottom + 12; } });
        promptResizeObserver.observe(editor);
      }
    }
    function adoptSnapshot(snapshot) {
      preparation = snapshot.preparation; state = snapshot.state; snapshotRevision = snapshot.revision;
      selectedProposal = snapshot.proposal;
      touched = new Set(snapshot.cache?.touched || []); parameterTouched = new Set(snapshot.cache?.parameterTouched || []); dirty = !!snapshot.cache;
      const targetValue = targets.find(value => value.shotID === target); if (targetValue) targetValue.workspaceRevision = snapshotRevision;
      if (savedBaselines.get(target)?.workspaceRevision !== snapshotRevision) savedBaselines.delete(target);
      observeSaveState(state.summary, snapshotRevision);
    }
    async function loadTarget(id, proposal = null, reloadNative = false) {
      rememberDraft(); clearTimeout(optionTimer);
      const previous = { preparation, state, touched, parameterTouched, revision: snapshotRevision, proposal: selectedProposal, dirty };
      const cached = drafts.get(id), ticket = ++epoch;
      loading = true; target = id; state = null; preparation = null; selectedProposal = null; dirty = false; touched = new Set(); parameterTouched = new Set(); invalidateQuote(); render(); status('正在读取参数…');
      try {
        const snapshot = await readSnapshot(id, proposal || cached?.proposal, reloadNative ? null : cached);
        if (ticket !== epoch) return false;
        const changed = cached && cached.revision !== snapshot.revision;
        if (changed || reloadNative) retainDraft(id, cached);
        adoptSnapshot(snapshot);
        const saved = proposals.find(value => value.state === 'applied' && value.preparation?.shotID === id && value.workspaceRevision === snapshotRevision && value.savedReceiptID);
        if (saved && workspaceSaved(state.summary) && !needsOverwrite()) savedBaselines.set(id, { workspaceRevision: saved.workspaceRevision, savedReceiptID: saved.savedReceiptID });
        status(changed || reloadNative ? '工坊参数已更新，请核对后再覆盖。' : workspaceSaved(state.summary) ? '' : unconfirmedSave(state.summary));
        return true;
      } catch (error) {
        if (ticket === epoch) {
          if (previous.preparation?.shotID === id) {
            preparation = previous.preparation; state = previous.state; touched = previous.touched; parameterTouched = previous.parameterTouched; snapshotRevision = previous.revision; dirty = previous.dirty; selectedProposal = previous.proposal;
          }
          status(error.message, true);
        }
        return false;
      } finally { if (ticket === epoch) { loading = false; render(); if (refreshRequested && active && !refreshFlight) queueMicrotask(() => refresh()); } }
    }
    function refresh(force = false) {
      if (!active) return Promise.resolve();
      refreshRequested = true; forceRefreshRequested ||= force;
      if (refreshFlight) return refreshFlight;
      if (busy || loading) return Promise.resolve();
      // Serialize reads and coalesce intervening requests into a trailing pass.
      // Writes are never cached or replayed; epoch guards every adoption.
      refreshFlight = (async () => {
        do {
          const requestedForce = forceRefreshRequested; refreshRequested = false; forceRefreshRequested = false;
          await refreshOnce(requestedForce);
        } while (active && refreshRequested && !busy && !loading);
      })().finally(() => { refreshFlight = null; scheduleRefresh(); });
      return refreshFlight;
    }
    async function refreshOnce(force = false) {
      if (!active || busy || loading) return;
      const refreshEpoch = epoch;
      if (openMenu && root.contains(openMenu.trigger)) closeMenu();
      try {
        const connected = await bridge.ensureConnection();
        if (refreshEpoch !== epoch || !active) return;
        if (!connected) { invalidate(); return; }
        const response = prefetchedProposals || await readProposalSnapshot(); prefetchedProposals = null;
        if (refreshEpoch !== epoch || !active) return;
        rememberProposals(response);
        const values = response.data.proposals || [];
        if (project && response.projectRef && project !== response.projectRef) invalidate();
        project = response.projectRef || project; proposals = values; targets = response.data.targets || [];
        const current = target; const targetNode = $('gbTarget');
        const displayedTargets = [...targets.filter(value => value.isGlobal === true), ...targets.filter(value => value.isGlobal !== true)];
        if (targetNode.options.length !== displayedTargets.length || displayedTargets.some((value, index) => targetNode.options[index]?.value !== value.shotID || targetNode.options[index]?.textContent !== value.canonicalReference)) {
          targetNode.replaceChildren(...displayedTargets.map(value => new Option(value.canonicalReference, value.shotID)));
        }
        const valid = value => value.state === 'proposed' && !staleProposals.has(value.proposalID) && !proposalExpired(value) && targets.find(target => target.shotID === value.preparation?.shotID)?.workspaceRevision === value.preparation?.expectedRevision;
        const preferred = proposals.find(value => value.proposalID === preferredProposalID && valid(value));
        const latest = preferred || proposals.find(valid);
        const nextTarget = preferred?.preparation?.shotID || (targets.some(value => value.shotID === current) ? current : latest?.preparation?.shotID || targets[0]?.shotID || '');
        // A notification can arrive while an older proposal read is in flight.
        // Only consume an intent that this response actually matched.
        if (preferred) preferredProposalID = null;
        targetNode.value = nextTarget;
        const nativeRevision = nextTarget ? revisionOf(targets.find(value => value.shotID === nextTarget)) : null;
        let changed = !!state && target === nextTarget && nativeRevision !== snapshotRevision, saveChanged = false;
        if (state && target === nextTarget && !changed && !(force && !hasLocalEdits(nextTarget))) {
          const ticket = epoch;
          const [currentSummary, businessStatus] = await Promise.all([read('generation.workspace', { shotID: nextTarget, part: 'summary' }), read('generation.businessStatus', { shotID: nextTarget })]);
          if (ticket !== epoch || target !== nextTarget || busy) return;
          requireRevision(currentSummary, snapshotRevision); requireRevision(businessStatus, snapshotRevision);
          saveChanged = currentSummary.summary?.saveState !== state.summary?.saveState || currentSummary.summary?.canSave !== state.summary?.canSave || currentSummary.summary?.writable !== state.summary?.writable;
          changed = businessStatus.platformID !== state.businessStatus?.platformID;
          state.summary = currentSummary.summary; state.businessStatus = businessStatus; observeSaveState(state.summary, snapshotRevision);
          if ($('gbProvider')) $('gbProvider').textContent = providerTitle();
          if (saveChanged && !workspaceSaved(state.summary)) status(unconfirmedSave(state.summary), true);
        }
        if (changed) {
          if (selectedProposal) staleProposals.add(selectedProposal.proposalID);
          invalidateQuote();
          selectedProposal = null;
        }
        const incoming = latest?.preparation?.shotID === nextTarget && (preferred || !hasLocalEdits(nextTarget)) && latest.proposalID !== selectedProposal?.proposalID ? latest : null;
        if (nextTarget && (nextTarget !== target || !state || incoming || changed || (force || saveChanged) && !hasLocalEdits(nextTarget))) await loadTarget(nextTarget, incoming || (nextTarget === target && !changed ? selectedProposal : null), changed);
        else if (!nextTarget) { target = ''; render(); }
        buttons();
      } catch (error) { if (refreshEpoch === epoch) { status(error.message, true); buttons(); } }
    }
    function scheduleRefresh() { clearTimeout(refreshTimer); if (active && Date.now() < activeUntil && document.visibilityState === 'visible') refreshTimer = setTimeout(refresh, Math.min(5000, activeUntil - Date.now())); }
    $('gbTarget').onchange = () => {
      const id = $('gbTarget').value;
      if (id === target && (state || loading) && !refreshRequested) return;
      return loadTarget(id, proposals.find(value => value.preparation?.shotID === id && value.state === 'proposed') || null);
    };
    function patchFor(value, proposal, changedKeys, changedParameters, options) {
      const patch = proposal ? clone(proposal.preparation) : { shotID: value.shotID, expectedRevision: value.expectedRevision };
      for (const key of changedKeys) {
        if (['modelParameters', 'clearModelParameters'].includes(key)) continue;
        delete patch[key]; if (value[key] !== undefined) patch[key] = clone(value[key]);
      }
      if (changedKeys.has('candidateLanes')) delete patch.candidateCount;
      if (changedKeys.has('modelID')) {
        if (value.modelID) delete patch.clearModel; else { delete patch.modelID; patch.clearModel = true; }
        if (value.modelID !== proposal?.preparation?.modelID) { delete patch.modelParameters; delete patch.clearModelParameters; }
      }
      if (changedParameters.size) {
        const parameters = { ...(patch.modelParameters || {}) }, cleared = new Set(patch.clearModelParameters || []);
        for (const key of changedParameters) {
          delete parameters[key]; cleared.delete(key);
          if (Object.prototype.hasOwnProperty.call(value.modelParameters || {}, key) && !(value.clearModelParameters || []).includes(key)) parameters[key] = value.modelParameters[key];
          else cleared.add(key);
        }
        if (Object.keys(parameters).length) patch.modelParameters = parameters; else delete patch.modelParameters;
        if (cleared.size) patch.clearModelParameters = [...cleared]; else delete patch.clearModelParameters;
      }
      for (const [key, control] of [['aspectRatio', 'aspectRatio'], ['resolution', 'resolution'], ['durationSeconds', 'duration']]) if (!options?.controls?.[control]?.enabled) delete patch[key];
      if (patch.referenceMode === 'omni') { delete patch.startReferenceID; delete patch.endReferenceID; delete patch.ordinaryReferenceIDs; }
      if (patch.referenceMode === 'frames') delete patch.ordinaryReferenceIDs;
      if (['startReferenceID', 'endReferenceID', 'ordinaryReferenceIDs'].some(key => changedKeys.has(key)) && !patch.referenceMode) patch.referenceMode = value.referenceMode;
      return patch;
    }
    function preparationPatch() { return patchFor(preparation, selectedProposal, touched, parameterTouched, state?.options); }
    async function readSavedParameters(expectedRevision) {
      const snapshot = await readSnapshot(target);
      if (expectedRevision != null && snapshot.revision !== expectedRevision) {
        if (selectedProposal) staleProposals.add(selectedProposal.proposalID);
        rememberDraft(); retainDraft(target, drafts.get(target)); invalidateQuote(); adoptSnapshot(snapshot);
        throw Error('工坊参数已更新，请核对后再覆盖。');
      }
      adoptSnapshot(snapshot);
      if (!workspaceSaved(state.summary)) throw Error(unconfirmedSave(state.summary));
      if (savedBaselines.get(target)?.workspaceRevision === snapshotRevision) invalidatedSavedRevisions.delete(target);
      return snapshot.inspection;
    }
    async function ensureParametersSaved(explicitOverwrite) {
      if (pendingSaves.has(target)) return await reconcileSavedParameters();
      if (needsOverwrite() && !explicitOverwrite) throw Error(unconfirmedSave(state?.summary));
      if (savedBaseline() && !dirty && !selectedProposal) {
        return await readSavedParameters(savedBaseline().workspaceRevision);
      }
      if (!canApply()) throw Error('当前参数不可覆盖，请核对输入。');
      const current = await read('generation.workspace', { shotID: target, part: 'summary' });
      if (revisionOf(current) !== snapshotRevision) {
        await loadTarget(target, null, true);
        throw Error('工坊参数已更新，请核对后再覆盖。');
      }
      state.summary = current.summary; observeSaveState(state.summary, snapshotRevision);
      if (!state.summary?.writable || needsOverwrite() && !explicitOverwrite) throw Error(unconfirmedSave(state.summary));
      const patch = preparationPatch();
      const proposal = selectedProposal;
      status('等待确认覆盖参数…');
      const response = await invoke('generation.apply', proposal ? { proposalID: proposal.proposalID, expectedProposalRevision: proposal.proposalRevision, preparation: patch } : { preparation: patch });
      const applied = response.data;
      if (['saved', 'applied'].includes(response.operation?.status)) pendingSaves.set(target, { operation: response.operation, baseRevision: snapshotRevision });
      const saved = applied.applied;
      if (!saved && pendingSaves.has(target)) return await reconcileSavedParameters();
      if (!saved || saved.shotID !== target || !saved.savedReceiptID) throw Error('参数保存尚未确认，请核对原操作。');
      const revision = revisionOf(saved);
      if (saved.preparation && saved.preparation.expectedRevision !== revision) throw Error('参数保存版本未能核对。');
      if (saved.workspace) for (const part of ['summary', 'options', 'references', 'prompt']) requireRevision(saved.workspace[part], revision);
      // Record the save before any later read/quote can fail. An explicit retry
      // must continue from this receipt, never repeat the writer operation.
      savedBaselines.set(target, { workspaceRevision: revision, savedReceiptID: saved.savedReceiptID });
      pendingSaves.delete(target);
      if (saved.preparation && saved.workspace) {
        preparation = clone(saved.preparation);
        state = { summary: saved.workspace.summary.summary, options: saved.workspace.options.options, references: saved.workspace.references.references, businessStatus: state.businessStatus };
      }
      preparation.expectedRevision = revision;
      snapshotRevision = revision;
      proposals = applied.proposals || proposals; selectedProposal = null;
      const targetValue = targets.find(value => value.shotID === target); if (targetValue) targetValue.workspaceRevision = revision;
      dirty = false; touched.clear(); parameterTouched.clear(); drafts.delete(target);
      invalidateQuote();
      return await readSavedParameters(revision);
    }
    async function reconcileSavedParameters() {
      // A saved receipt can omit the inline projection when it is too large.
      // Until reads establish its current state, this action may only read.
      const response = await readProposalSnapshot();
      const snapshot = await readSnapshot(target);
      proposals = response.data.proposals || proposals;
      const matching = proposals.filter(value => value.state === 'applied' && value.preparation?.shotID === target && value.workspaceRevision === snapshot.revision && value.workspaceRevision > pendingSaves.get(target)?.baseRevision && value.savedReceiptID);
      const saved = matching.length === 1 ? matching[0] : null;
      adoptSnapshot(snapshot); dirty = false; touched.clear(); parameterTouched.clear(); drafts.delete(target); invalidateQuote();
      if (!workspaceSaved(state.summary)) { pendingSaves.delete(target); throw Error(unconfirmedSave(state.summary)); }
      if (needsOverwrite()) { pendingSaves.delete(target); throw Error('当前保存回执已失效，请核对后再次覆盖。'); }
      if (!saved) {
        const previous = proposals.find(value => value.state === 'applied' && value.preparation?.shotID === target && value.workspaceRevision > pendingSaves.get(target)?.baseRevision && value.workspaceRevision < snapshot.revision && value.savedReceiptID);
        if (previous) { pendingSaves.delete(target); throw Error('工坊参数已更新，请核对后再覆盖。'); }
        throw Error('参数已保存，尚未取得当前保存回执；请刷新核对。');
      }
      savedBaselines.set(target, { workspaceRevision: snapshot.revision, savedReceiptID: saved.savedReceiptID });
      pendingSaves.delete(target);
      return snapshot.inspection;
    }
    async function ensureQuote(inspection) {
      if (!inspection.readyForQuote) throw Error(inspection.reason || '参数已保存，当前尚不能报价。');
      if (quoteValid()) return quote;
      status('等待报价批准…');
      const plan = await read('generation.quote', { shotID: target, expectedRevision: inspection.workspaceRevision });
      // Existing quote dates use Foundation's 2001 reference epoch.
      const expiresAt = typeof plan.expiresAt === 'number' ? (plan.expiresAt + 978307200) * 1000 : Date.parse(plan.expiresAt);
      if (!plan.id || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw Error('没有取得有效报价。');
      quote = { id: plan.id, amount: plan.amount, unit: plan.unit, expiresAt, target, workspaceRevision: snapshotRevision };
      quoteTimer = setTimeout(buttons, Math.max(1, expiresAt - Date.now()));
      return quote;
    }
    async function runAction(generate) {
      if (busy || loading || !(generate ? canGenerate() : canApply())) return;
      busy = true; clearTimeout(optionTimer); buttons();
      try {
        const inspection = await ensureParametersSaved(!generate);
        if (!generate) { status('参数已覆盖并保存。'); return; }
        const price = await ensureQuote(inspection);
        if (!quoteValid()) throw Error('报价已失效；未提交生成。');
        const planID = price.id; invalidateQuote();
        status('等待本次生成批准…');
        await read('generation.submit', { planID });
        status('已按宿主回执提交候选。');
      } catch (error) {
        let changed = false;
        if (preparation && !pendingSaves.has(target)) {
          try {
            const current = await read('generation.workspace', { shotID: target, part: 'summary' });
            if (revisionOf(current) !== snapshotRevision) changed = await loadTarget(target, null, true);
            else { state.summary = current.summary; observeSaveState(state.summary, snapshotRevision); }
          } catch { /* Keep the original operation failure if the read is unavailable. */ }
        }
        status(changed ? '工坊参数已更新，请核对后再覆盖。' : error.message, true);
      }
      finally { busy = false; render(); if (refreshRequested && active) refresh(); else scheduleRefresh(); }
    }
    $('gbApply').onclick = () => runAction(false);
    $('gbGenerate').onclick = () => runAction(true);
    function invalidate() { ++epoch; loading = false; target = ''; project = ''; state = null; preparation = null; selectedProposal = null; proposals = []; targets = []; dirty = false; snapshotRevision = null; touched.clear(); parameterTouched.clear(); drafts.clear(); savedBaselines.clear(); pendingSaves.clear(); invalidatedSavedRevisions.clear(); retainedDrafts.clear(); staleProposals.clear(); discoveryProject = null; discoveryReady = false; prefetchedProposals = null; seenProposals.clear(); invalidateQuote(); clearTimeout(optionTimer); $('gbTarget').replaceChildren(); render(); }
    return {
      setActive(value) { active = value; clearTimeout(refreshTimer); if (openMenu && root.contains(openMenu.trigger)) closeMenu(); if (active) { activeUntil = Date.now() + 30000; refresh(); } }, refresh: () => refresh(true), invalidate, observeProposals,
      activity() { activeUntil = Date.now() + 30000; scheduleRefresh(); },
      receiveToolResult(result) { const envelope = bridge.payload(result), data = envelope.result || envelope; if (Array.isArray(data.proposals) && data.proposals.length) { const next = data.proposals.find(value => value.state === 'proposed'); preferredProposalID = next?.proposalID || null; bridge.show?.(); if (active) refresh(); } }
    };
  }
  global.ArgoGenerationBoard = { mount };
})(window);
