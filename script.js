// Project loader for portfolio — fetches repos and collaborator repos (with optional token).
// Usage: edit username in index.html or use the input on the page. Optionally paste a PAT to include collaborator/private repos.
// WARNING: never commit a token to the repo. Token is stored only in browser localStorage.

(async function () {
  const usernameInput = document.getElementById('username');
  const tokenInput = document.getElementById('token');
  const loadBtn = document.getElementById('load');
  const clearBtn = document.getElementById('clearToken');
  const projectsEl = document.getElementById('projects');
  const nameEl = document.getElementById('name');
  const bioEl = document.getElementById('bio');

  const bodyUser = document.body.dataset.username;
  if (!usernameInput.value && bodyUser) usernameInput.value = bodyUser;

  const storedToken = localStorage.getItem('portfolio_token');
  if (storedToken) tokenInput.value = storedToken;

  clearBtn.addEventListener('click', () => {
    tokenInput.value = '';
    localStorage.removeItem('portfolio_token');
    alert('Token cleared from this browser.');
  });

  loadBtn.addEventListener('click', () => loadProjects(true));

  loadProjects(false);

  async function loadProjects(saveToken) {
    const username = (usernameInput.value || bodyUser || '').trim();
    const token = tokenInput.value.trim();
    if (!username) {
      projectsEl.innerHTML = '<div class="loading">Enter a GitHub username.</div>';
      return;
    }
    if (saveToken) {
      if (token) localStorage.setItem('portfolio_token', token);
      else localStorage.removeItem('portfolio_token');
    }

    projectsEl.innerHTML = '<div class="loading">Loading projects…</div>';

    const ghFetch = async (url, useAuth = false) => {
      const headers = { Accept: 'application/vnd.github.v3+json' };
      if (useAuth && token) headers.Authorization = `token ${token}`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${res.status} ${res.statusText}: ${errText}`);
      }
      return res.json();
    };

    try {
      let reposMap = new Map();

      if (token) {
        let page = 1;
        while (true) {
          const url = `https://api.github.com/user/repos?per_page=100&page=${page}&affiliation=owner,collaborator`;
          const items = await ghFetch(url, true);
          if (!items || items.length === 0) break;
          for (const r of items) reposMap.set(r.full_name, r);
          if (items.length < 100) break;
          page++;
        }
      } else {
        let page = 1;
        while (true) {
          const url = `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&page=${page}&type=owner&sort=updated`;
          const items = await ghFetch(url, false);
          if (!items || items.length === 0) break;
          for (const r of items) reposMap.set(r.full_name, r);
          if (items.length < 100) break;
          page++;
        }
      }

      try {
        const events = await ghFetch(`https://api.github.com/users/${encodeURIComponent(username)}/events/public`, !!token);
        for (const ev of events) {
          if (ev.type === 'PushEvent' || ev.type === 'PullRequestEvent' || ev.repo) {
            const fullName = ev.repo && ev.repo.name;
            if (fullName && !reposMap.has(fullName)) {
              try {
                const r = await ghFetch(`https://api.github.com/repos/${fullName}`, !!token);
                reposMap.set(r.full_name, r);
              } catch (e) {
                console.warn('Repo fetch failed:', e.message);
              }
            }
          }
        }
      } catch (e) {
        console.warn('Events fetch failed:', e.message);
      }

      const repos = Array.from(reposMap.values()).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

      if (repos.length === 0) {
        projectsEl.innerHTML = '<div class="loading">No repositories found for this user.</div>';
        return;
      }

      projectsEl.innerHTML = '';
      for (const r of repos) {
        const card = document.createElement('div');
        card.className = 'card';

        const name = document.createElement('h3');
        const link = document.createElement('a');
        link.href = r.html_url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = r.full_name;
        name.appendChild(link);

        const desc = document.createElement('p');
        desc.textContent = r.description || '';

        const meta = document.createElement('div');
        meta.className = 'meta';

        const lang = document.createElement('span');
        lang.className = 'badge';
        lang.textContent = r.language || '—';

        const stars = document.createElement('span');
        stars.textContent = `★ ${r.stargazers_count || 0}`;

        meta.appendChild(lang);
        meta.appendChild(stars);

        card.appendChild(name);
        if (desc.textContent) card.appendChild(desc);
        card.appendChild(meta);

        projectsEl.appendChild(card);
      }
    } catch (err) {
      projectsEl.innerHTML = `<div class="loading">Error loading projects: ${err.message}</div>`;
      console.error(err);
    }
  }
})();
