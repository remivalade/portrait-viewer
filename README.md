# Guide de démarrage rapide – Portrait Viewer

## 1. Structure du projet

```
portrait-viewer/
├─ backend/
│  ├─ fetch-job.js   ← synchronisation quotidienne (Base Sepolia ➜ Portrait API)
│  └─ api.js         ← API JSON paginée consommée par le front‑end
├─ frontend/         ← Galerie React + Vite
└─ package.json      ← scripts & dépendances back‑end
```

---

## 2. Prérequis

- **Node ≥ 18 (LTS)** – « Node.js » est le moteur JavaScript côté serveur. Il faut la version 18 ou plus récente ; *LTS* signifie « Long‑Term Support », la branche la plus stable.
- **npm** – le **n**ode **p**ackage **m**anager. Il vient automatiquement avec Node et sert à télécharger les bibliothèques open‑source dont le projet a besoin.

### En bref : c’est quoi ?

| Terme        | À quoi ça sert ?                                                                                         | Comment l’installer/vérifier ?                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Node.js**  | Exécuter du JavaScript en dehors du navigateur ; indispensable pour le back‑end et les outils front‑end. | <https://nodejs.org> → bouton **LTS**. `node -v` doit afficher `v18.x` ou +. |
| **npm**      | Télécharge les dépendances définies dans `package.json`.                                                 | Inclus avec Node. `npm -v` affiche la version.                                                  |
| **Terminal** | L’application dans laquelle vous tapez les commandes (Mac = Terminal, Windows = PowerShell/WSL).         | Ouvrez‑la depuis votre OS.                                                                      |
| **CLI**      | *Command‑Line Interface* : on pilote les outils en tapant des commandes.                                 | —                                                                                               |
| **Cron**     | Planificateur de tâches sous Linux/macOS pour lancer quelque chose tous les jours.                       | `crontab -e` ouvre votre liste de tâches.                                                       |

Installez ensuite les dépendances :

```bash
npm install                # dépendances back‑end
cd frontend
npm install                # dépendances front‑end
cd ..
```

---

## 3. Synchronisation ponctuelle (facultatif)

```bash
npm run fetch              # exécute backend/fetch-job.js une fois
```

Génère / met à jour :

- **backend/cache.json** – portraits publiés
- **backend/meta.json**  – méta‑données (ID max, listes non publiées, map CID)

---

## 4. Lancement en mode développement

Ouvrez **deux terminaux** :

```bash
# Terminal A – API
npm run api
# ➜ http://localhost:3001/api/portraits?page=1&limit=3

# Terminal B – Front‑end
cd frontend
npm run dev
# ➜ http://localhost:5173
```

La galerie React charge les portraits à la volée via l’API.

---

## 5. Rafraîchissement quotidien automatique

### 5.1 Cron local (macOS / Linux)

```cron
0 3 * * * cd /path/to/portrait-viewer && /usr/bin/node backend/fetch-job.js >> cron.log 2>&1
```

### 5.2 Railway / Render / Fly

1. Déployez le repo comme service Node (`npm run api` en commande de démarrage).
2. Ajoutez un **Cron job** qui exécute `node backend/fetch-job.js` une fois toutes les 24 h.

> L’API lit toujours le dernier **cache.json** ; aucun redémarrage nécessaire.

---

## 6. Variables d’environnement (facultatif)

| Variable                   | Valeur par défaut                     | Quand la modifier                                    |
| -------------------------- | ------------------------------------- | ---------------------------------------------------- |
| `PORT` (back‑end)          | 3001                                  | Si le port 3001 est déjà occupé.                     |
| `VITE_API_URL` (front‑end) | `http://localhost:3001/api/portraits` | URL de l’API en production (Vercel / Netlify, etc.). |

---

## 7. Commandes courantes

| Tâche                      | Commande          | Dossier     |
| -------------------------- | ----------------- | ----------- |
| Synchronisation manuelle   | `npm run fetch`   | racine      |
| Lancer uniquement l’API    | `npm run api`     | racine      |
| Lancer le dev‑server front | `npm run dev`     | `frontend/` |
| Construire le front static | `npm run build`   | `frontend/` |
| Pré‑visualiser le build    | `npm run preview` | `frontend/` |

---

## 8. Arrêter les services

- **Ctrl +C** dans le terminal concerné.
- Ou tuer le processus par PID : `lsof -i :3001` puis `kill <PID>` (sous Windows : `Get-Process node` → `Stop-Process -Id <PID>`).

`fetch-job.js` intercepte Ctrl +C, sauvegarde le cache partiel puis se termine.

---

## 9. Dépannage rapide

| Symptôme                                      | Solution                                                                                              |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `ERR_CONNECTION_REFUSED` sur `/api/portraits` | Vérifiez que `npm run api` tourne et que `VITE_API_URL` pointe vers le bon port.                      |
| L’API répond `{ "total": 0 }`                 | Attendez la fin de `fetch-job.js` ou inspectez **backend/cache.json**.                                |
| Erreur « RPC unreachable »                    | L’endpoint public est hors‑ligne : le script bascule automatiquement, sinon mettez à jour `RPC_URLS`. |
| Images manquantes                             | Les CIDs viennent d’être publiés : le gateway IPFS peut mettre quelques minutes à servir le fichier.  |

---

Bon hack ! 🎉
