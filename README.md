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

| Terme        | À quoi ça sert ?                                                                                         | Comment l’installer/vérifier ?                                                                   |
|--------------|----------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| **Node.js**  | Exécuter du JavaScript en dehors du navigateur ; indispensable pour le back‑end et les outils front‑end. | <https://nodejs.org> → bouton **LTS** · `node -v` doit afficher `v18.x` ou plus.                 |
| **npm**      | Télécharge les dépendances définies dans `package.json`.                                                 | Inclus avec Node · `npm -v` affiche la version.                                                  |
| **Terminal** | Application où vous tapez les commandes (Mac = Terminal, Windows = PowerShell/WSL).                      | Ouvrez‑la depuis votre OS.                                                                       |
| **CLI**      | *Command‑Line Interface* : on pilote les outils en tapant des commandes.                                  | —                                                                                                |
| **Cron**     | Planificateur de tâches Linux/macOS pour lancer un script régulièrement.                                 | `crontab -e` ouvre votre liste de tâches.                                                        |

```bash
npm install                # dépendances back‑end
cd frontend
npm install                # dépendances front‑end
cd ..
```

---

## 3. Synchronisation ponctuelle

```bash
npm run fetch              # exécute backend/fetch-job.js une fois
```

Crée / met à jour :

- **backend/cache.json** – portraits publiés
- **backend/meta.json**  – méta‑données (ID max, CIDs, etc.)

---

## 4. Lancement en mode développement

```bash
# Terminal A – API
npm run api        # http://localhost:3001/api/portraits?page=1&limit=3

# Terminal B – Front‑end
cd frontend
npm run dev        # http://localhost:5173
```

---

## 5. Mise à jour quotidienne automatique

### 5.1 Cron local

```cron
0 3 * * * cd /path/to/portrait-viewer && /usr/bin/node backend/fetch-job.js >> cron.log 2>&1
```

### 5.2 Railway / Render / Fly

1. Déployer le repo comme service Node (`npm run api` en commande de démarrage).  
2. Créer un **Cron job** : `node backend/fetch-job.js` (tous les jours).

---

## 6. Variables d’environnement utiles

| Variable                   | Valeur par défaut                           | Usage                                |
|----------------------------|---------------------------------------------|--------------------------------------|
| `PORT` (back‑end)          | 3001                                        | Changer si le port est occupé.       |
| `VITE_API_URL` (front‑end) | `http://localhost:3001/api/portraits`       | Pointage vers l’API en production.   |

---

## 7. Commandes courantes

| Tâche                      | Commande            | Dossier     |
|----------------------------|---------------------|-------------|
| Synchronisation manuelle   | `npm run fetch`     | racine      |
| Lancer l’API               | `npm run api`       | racine      |
| Dev‑server front‑end       | `npm run dev`       | frontend/   |
| Build front‑end            | `npm run build`     | frontend/   |

---

## 8. Arrêter les services

- appuyez sur **Ctrl +C** dans le terminal concerné.  
- ou tuez le processus par port : `lsof -i :3001` puis `kill <PID>`.

`fetch-job.js` intercepte Ctrl +C, sauvegarde le cache partiel et se ferme proprement.

---

## 9. Dépannage express

| Problème                                        | Solution                                             |
|-------------------------------------------------|------------------------------------------------------|
| `ERR_CONNECTION_REFUSED` sur `/api/portraits`   | L’API n’est pas lancée : exécuter `npm run api`.     |
| L’API renvoie `{ "total": 0 }`                  | Attendre la fin de `fetch-job.js` (ou relancer).     |
| Erreur « RPC unreachable »                      | Le nœud public est down : le script bascule ou modifiez `RPC_URLS`. |
| Vignettes manquantes                            | Les CIDs viennent d’être publiés : attendre quelques minutes ou changer de passerelle IPFS. |

Bon hack ! 🎉
