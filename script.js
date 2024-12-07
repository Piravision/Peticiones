// script.js

// Importar las funciones necesarias desde Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, writeBatch } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// Tu configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBET8zN73NmBploRE8wgq_n737eR_hxpXw",
    authDomain: "solicitudesapp-b2632.firebaseapp.com",
    projectId: "solicitudesapp-b2632",
    storageBucket: "solicitudesapp-b2632.appspot.com",
    messagingSenderId: "542690661887",
    appId: "1:542690661887:web:da612bb06f56fcd5bfc3ca"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Variables del DOM
const inputNombre = document.getElementById('nombre');
const inputAnio = document.getElementById('anio');
const btnBuscar = document.getElementById('btnBuscar');
const resultsTable = document.getElementById('resultsTable');
const resultsList = document.getElementById('resultsList');
const selectedContentDiv = document.getElementById('selectedContent');

const solicitudContainer = document.getElementById('solicitudContainer');
const solicitudUsuario = document.getElementById('solicitudUsuario');
const solicitudFranja = document.getElementById('solicitudFranja');
const btnEnviarSolicitud = document.getElementById('btnEnviarSolicitud');

const tablaSolicitudesBody = document.querySelector('#tablaSolicitudes tbody');
const tablaSolicitudes = document.getElementById('tablaSolicitudes');

// Elementos de autenticación
const loginContainer = document.getElementById('loginContainer');
const btnLoginGoogle = document.getElementById('btnLoginGoogle');
const btnLogout = document.getElementById('btnLogout');
const loginStatus = document.getElementById('loginStatus');

// Botón para borrar solicitudes
const btnBorrarSolicitudes = document.getElementById('btnBorrarSolicitudes');

// Reemplaza con tu propia clave de TMDb
const TMDB_API_KEY = "834a733b9049f196062484fc97f21452"; 

// Variables para el contenido seleccionado
let selectedContentData = null;
let selectedType = 'movie'; 

// Actualizar el tipo seleccionado cuando se cambia el radio button
document.getElementsByName('tipo').forEach(radio => {
  radio.addEventListener('change', e => {
    selectedType = e.target.value;
  });
});

// Función para cargar las últimas solicitudes desde Firestore
async function loadLastRequests() {
    try {
        // Crear una consulta para obtener las últimas 5 solicitudes ordenadas por timestamp descendente
        const solicitudesQuery = query(
            collection(db, 'solicitudes'),
            orderBy('timestamp', 'desc'),
            limit(5)
        );

        const querySnapshot = await getDocs(solicitudesQuery);

        // Limpiar la tabla antes de agregar nuevas filas
        tablaSolicitudesBody.innerHTML = '';

        querySnapshot.forEach((doc) => {
            const solicitud = doc.data();
            addSolicitudToTable(solicitud);
        });
    } catch (error) {
        console.error("Error al cargar las solicitudes:", error);
    }
}

// Función para agregar una solicitud a Firestore y actualizar la tabla
async function addSolicitud(solicitud) {
    try {
        // Añadir la solicitud a Firestore con un timestamp
        await addDoc(collection(db, 'solicitudes'), {
            ...solicitud,
            timestamp: new Date()
        });

        // Actualizar la tabla en la página principal (solo las últimas 5)
        const currentRows = tablaSolicitudesBody.querySelectorAll('tr');
        if (currentRows.length >= 5) {
            // Eliminar la última fila si ya hay 5
            tablaSolicitudesBody.removeChild(currentRows[currentRows.length - 1]);
        }
        addSolicitudToTable(solicitud);

        // Gestionar el límite de 20 solicitudes en Firestore
        await maintainSolicitudLimit(20);
    } catch (error) {
        console.error("Error añadiendo la solicitud:", error);
        alert("Hubo un error al enviar tu solicitud. Por favor, intenta de nuevo.");
    }
}

// Función para añadir una fila a la tabla de solicitudes
function addSolicitudToTable({userName, title, year, type, franja, poster}) {
    const tr = document.createElement('tr');

    const tdUser = document.createElement('td');
    tdUser.textContent = userName;

    const tdTitle = document.createElement('td');
    tdTitle.textContent = title;

    const tdYear = document.createElement('td');
    tdYear.textContent = year;

    const tdType = document.createElement('td');
    tdType.textContent = type;

    const tdFranja = document.createElement('td');
    tdFranja.textContent = franja;

    const tdPoster = document.createElement('td');
    if (poster) {
        const img = document.createElement('img');
        img.src = poster;
        img.alt = "Carátula";
        img.style.width = "50px";
        img.style.maxWidth = "50px"; // Asegurar que no sea demasiado grande
        tdPoster.appendChild(img);
    } else {
        tdPoster.textContent = 'N/A';
    }

    tr.appendChild(tdUser);
    tr.appendChild(tdTitle);
    tr.appendChild(tdYear);
    tr.appendChild(tdType);
    tr.appendChild(tdFranja);
    tr.appendChild(tdPoster);

    tablaSolicitudesBody.appendChild(tr);
}

// Función para mantener el límite de solicitudes en Firestore
async function maintainSolicitudLimit(maxLimit) {
    try {
        // Obtener todas las solicitudes ordenadas por timestamp ascendente (las más antiguas primero)
        const solicitudesQuery = query(
            collection(db, 'solicitudes'),
            orderBy('timestamp', 'asc')
        );

        const querySnapshot = await getDocs(solicitudesQuery);

        const totalSolicitudes = querySnapshot.size;

        if (totalSolicitudes > maxLimit) {
            const batch = writeBatch(db);
            let solicitudesToDelete = totalSolicitudes - maxLimit;

            querySnapshot.forEach((docSnap) => {
                if (solicitudesToDelete > 0) {
                    batch.delete(docSnap.ref);
                    solicitudesToDelete--;
                }
            });

            await batch.commit();
            console.log(`Se eliminaron ${totalSolicitudes - maxLimit} solicitudes antiguas para mantener el límite de ${maxLimit}.`);
        }
    } catch (error) {
        console.error("Error manteniendo el límite de solicitudes:", error);
    }
}

// Evento para el botón de búsqueda
btnBuscar.addEventListener('click', async () => {
  const queryText = inputNombre.value.trim();
  const year = inputAnio.value.trim();

  if(!queryText) {
    alert("Por favor ingresa un nombre para la búsqueda.");
    return;
  }

  // Validación del año
  if(year && (!/^\d{4}$/.test(year) || parseInt(year) < 1900 || parseInt(year) > new Date().getFullYear())) {
    alert("Por favor ingresa un año válido.");
    return;
  }

  const results = await searchInTMDB(queryText, selectedType, year);

  if (results && results.length > 0) {
    // Mostrar la tabla de resultados
    resultsTable.style.display = 'table';
    showSearchResults(results.slice(0,5)); 
  } else {
    resultsTable.style.display = 'table';
    resultsList.innerHTML = "<tr><td colspan='2'>No se encontraron resultados.</td></tr>";
  }

  // Ocultar la ficha del contenido seleccionado si estaba visible
  selectedContentDiv.style.display = 'none';
});

// Función para buscar en TMDb
async function searchInTMDB(query, type, year) {
  const tmdbType = (type === 'movie') ? 'movie' : 'tv';
  let url = `https://api.themoviedb.org/3/search/${tmdbType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=es`;
  if (year) {
    if (tmdbType === 'movie') {
      url += `&year=${year}`;
    } else {
      url += `&first_air_date_year=${year}`;
    }
  }

  try {
    const res = await fetch(url);
    const data = await res.json();
    const results = (data.results || []).map(item => {
      const releaseYear = tmdbType==='movie' ? 
        (item.release_date ? item.release_date.slice(0,4) : "") :
        (item.first_air_date ? item.first_air_date.slice(0,4) : "");
      return {
        title: item.title || item.name,
        year: releaseYear,
        id: item.id,
        type: type,
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w200/${item.poster_path}` : ''
      };
    });

    // Filtrar por año < 2006
    const filteredResults = results.filter(r => {
      return r.year && parseInt(r.year) < 2006;
    });

    return filteredResults;
  } catch (error) {
    console.error("Error al buscar en TMDb:", error);
    return [];
  }
}

// Función para mostrar los resultados de la búsqueda
function showSearchResults(results) {
  resultsList.innerHTML = "";
  if (results.length === 0) {
    resultsList.innerHTML = "<tr><td colspan='2'>No se encontraron resultados filtrados.</td></tr>";
    return;
  }
  
  results.forEach(item => {
    const tr = document.createElement('tr');
    
    const tdTitle = document.createElement('td');
    tdTitle.textContent = item.title;
    tdTitle.style.cursor = 'pointer';
    tdTitle.addEventListener('click', () => {
      selectContent(item);
    });

    const tdYear = document.createElement('td');
    tdYear.textContent = item.year;
    
    tr.appendChild(tdTitle);
    tr.appendChild(tdYear);
    
    resultsList.appendChild(tr);
  });
}

// Función para seleccionar un contenido y mostrar sus detalles
async function selectContent(item) {
  const details = await getTMDBDetails(item.id, item.type);
  if (details) {
    selectedContentData = details;
    showSelectedContent(details);
    // Ocultar la tabla de resultados
    resultsTable.style.display = 'none';
    // Establecer la imagen de fondo de la ficha del contenido seleccionado
    setSelectedContentBackground(details.backdrop);
  } else {
    alert("No se pudieron obtener los detalles del contenido seleccionado.");
  }
}

// Función para obtener detalles adicionales de TMDb
async function getTMDBDetails(id, type) {
  const tmdbType = (type==='movie')?'movie':'tv';
  const detailUrl = `https://api.themoviedb.org/3/${tmdbType}/${id}?api_key=${TMDB_API_KEY}&language=es`;
  const creditsUrl = `https://api.themoviedb.org/3/${tmdbType}/${id}/credits?api_key=${TMDB_API_KEY}&language=es`;
  const logosUrl = `https://api.themoviedb.org/3/${tmdbType}/${id}/images?api_key=${TMDB_API_KEY}`;

  try {
    const [detailRes, creditsRes, logosRes] = await Promise.all([fetch(detailUrl), fetch(creditsUrl), fetch(logosUrl)]);
    const detailData = await detailRes.json();
    const creditsData = await creditsRes.json();
    const logosData = await logosRes.json();

    let director = {
      name: "Desconocido",
      title: "",
      profile: null
    };

    if (type === 'movie') {
      const directorData = creditsData.crew.find(member => member.job === 'Director');
      if (directorData) {
        director.name = directorData.name;
        director.title = directorData.job; // "Director"
        if (directorData.profile_path) {
          director.profile = `https://image.tmdb.org/t/p/w200/${directorData.profile_path}`;
        }
      }
    } else {
      // Para series: creador en "created_by"
      if (detailData.created_by && detailData.created_by.length > 0) {
        director.name = detailData.created_by[0].name;
        director.title = "Creador"; // Asignar un título adecuado
        if (detailData.created_by[0].profile_path) {
          director.profile = `https://image.tmdb.org/t/p/w200/${detailData.created_by[0].profile_path}`;
        }
      }
    }

    // Obtener el logo en castellano si está disponible, si no, usar el logo en inglés
    let logo_es = null;
    if (logosData.logos && logosData.logos.length > 0) {
      const logoEnEspañol = logosData.logos.find(logo => logo.iso_639_1 === 'es');
      if (logoEnEspañol) {
        logo_es = `https://image.tmdb.org/t/p/w300/${logoEnEspañol.file_path}`;
      } else {
        // Buscar logo en inglés
        const logoEnIngles = logosData.logos.find(logo => logo.iso_639_1 === 'en');
        if (logoEnIngles) {
          logo_es = `https://image.tmdb.org/t/p/w300/${logoEnIngles.file_path}`;
        } else {
          // Usar una imagen predeterminada si no se encuentra ningún logo
          logo_es = 'default_logo_en.png'; // Asegúrate de tener este archivo en tu directorio
        }
      }
    } else {
      // Usar una imagen predeterminada si no hay logos
      logo_es = 'default_logo_en.png'; // Asegúrate de tener este archivo en tu directorio
    }

    const cast = (creditsData.cast || []).slice(0,5).map(actor => ({
      name: actor.name,
      profile: actor.profile_path ? `https://image.tmdb.org/t/p/w200/${actor.profile_path}` : null
    }));

    const genre = (detailData.genres && detailData.genres.length > 0) ? detailData.genres[0].name : "Desconocido";
    const year = (type === 'movie') ? (detailData.release_date ? detailData.release_date.slice(0,4) : "") : (detailData.first_air_date ? detailData.first_air_date.slice(0,4) : "");
    const poster = detailData.poster_path ? `https://image.tmdb.org/t/p/w300/${detailData.poster_path}` : null;
    const backdrop = detailData.backdrop_path ? `https://image.tmdb.org/t/p/w780/${detailData.backdrop_path}` : null;
    const overview = detailData.overview || "Sin descripción.";

    return {
      type,
      id: detailData.id,
      title: detailData.title || detailData.name,
      year: year,
      poster,
      backdrop,
      director,
      cast,
      genre,
      overview,
      logo_es
    };
  } catch (error) {
    console.error("Error al obtener detalles de TMDb:", error);
    return null;
  }
}

// Función para mostrar el contenido seleccionado
function showSelectedContent(content) {
  selectedContentDiv.innerHTML = "";
  selectedContentDiv.style.display = 'flex'; // Cambiar a flex para el layout

  const infoDiv = document.createElement('div');
  infoDiv.classList.add('info');

  // Agregar el logo en castellano o inglés si está disponible
  if (content.logo_es && content.logo_es !== 'default_logo_en.png') {
    const logoEs = document.createElement('img');
    logoEs.src = content.logo_es;
    logoEs.alt = 'Logo';
    logoEs.classList.add('logo-es');
    infoDiv.appendChild(logoEs);
  }

  // Crear una tabla para las variables en dos columnas
  const infoTable = document.createElement('table');
  infoTable.classList.add('info-table');

  // Función para agregar una fila a la tabla
  function addInfoRow(label, value) {
    const tr = document.createElement('tr');

    const tdLabel = document.createElement('td');
    tdLabel.textContent = label;

    const tdValue = document.createElement('td');
    tdValue.innerHTML = value; // Usar innerHTML para insertar HTML

    tr.appendChild(tdLabel);
    tr.appendChild(tdValue);

    infoTable.appendChild(tr);
  }

  // Agregar las variables
  addInfoRow("Título:", content.title);
  addInfoRow("Año:", content.year);
  addInfoRow("Género:", content.genre);

  // Director con imagen y nombre
  let directorHTML = '';
  if (content.director.profile) {
    directorHTML = `
      <div class="director-info">
        <img src="${content.director.profile}" alt="${content.director.name}" />
        <span>${content.director.name} (${content.director.title})</span>
      </div>
    `;
  } else {
    directorHTML = `<span>${content.director.name} (${content.director.title})</span>`;
  }
  addInfoRow("Director:", directorHTML);

  // Reparto con imágenes y nombres
  let repartoHTML = '<div class="cast-info">';
  content.cast.forEach(actor => {
    if(actor.profile){
      repartoHTML += `
        <div class="actor-info">
          <img src="${actor.profile}" alt="${actor.name}" />
          <span>${actor.name}</span>
        </div>
      `;
    } else {
      repartoHTML += `<div class="actor-info"><span>${actor.name}</span></div>`;
    }
  });
  repartoHTML += '</div>';
  addInfoRow("Reparto:", repartoHTML);

  addInfoRow("Sinopsis:", content.overview);

  infoDiv.appendChild(infoTable);
  infoDiv.appendChild(solicitarBtn());

  selectedContentDiv.appendChild(infoDiv);
  selectedContentDiv.appendChild(posterDiv(content.poster));
}

// Función para crear el botón de solicitar contenido
function solicitarBtn() {
  const btn = document.createElement('button');
  btn.textContent = "Solicitar Contenido";
  btn.addEventListener('click', () => {
    showSolicitudForm();
  });
  return btn;
}

// Función para mostrar el poster del contenido seleccionado
function posterDiv(posterUrl) {
  const div = document.createElement('div');
  div.classList.add('poster');
  if (posterUrl) {
    const posterImg = document.createElement('img');
    posterImg.src = posterUrl;
    posterImg.alt = "Poster";
    posterImg.style.width = "300px"; // Cambia este valor para ajustar el ancho del poster
    posterImg.style.height = "auto"; // Cambia este valor para ajustar la altura del poster
    div.appendChild(posterImg);
  }
  return div;
}

// Función para mostrar el formulario de solicitud
function showSolicitudForm() {
  solicitudContainer.style.display = "block";
}

// Evento para el botón de enviar solicitud
btnEnviarSolicitud.addEventListener('click', async () => {
  const userName = solicitudUsuario.value.trim();
  const franja = solicitudFranja.value;

  if (!userName || !selectedContentData) {
    alert("Falta información: Asegúrate de haber seleccionado contenido y llenado tu nombre de usuario.");
    return;
  }

  await addSolicitud({
    userName,
    title: selectedContentData.title,
    year: selectedContentData.year,
    type: (selectedContentData.type === 'movie') ? 'Película' : 'Serie',
    franja,
    poster: selectedContentData.poster
  });

  solicitudUsuario.value = "";
  solicitudFranja.value = "Mañana";
  solicitudContainer.style.display = "none";

  // Ocultar la ficha del contenido seleccionado
  selectedContentDiv.style.display = 'none';
});

// Función para establecer la imagen de fondo de la ficha del contenido seleccionado
function setSelectedContentBackground(backdropUrl) {
    if (backdropUrl) {
        selectedContentDiv.style.backgroundImage = `url(${backdropUrl})`;
        selectedContentDiv.style.backgroundSize = 'cover';
        selectedContentDiv.style.backgroundPosition = 'center';
        selectedContentDiv.style.backgroundRepeat = 'no-repeat';
        selectedContentDiv.style.backgroundBlendMode = 'darken'; // Para mejorar la legibilidad
    } else {
        selectedContentDiv.style.backgroundImage = '';
        selectedContentDiv.style.backgroundBlendMode = 'normal';
    }
}

// Función administrativa para limpiar todas las solicitudes (Solo Admin)
async function clearSolicitudes() {
    try {
        const solicitudesSnapshot = await getDocs(collection(db, 'solicitudes'));
        const batch = writeBatch(db);

        solicitudesSnapshot.forEach((docSnap) => {
            batch.delete(docSnap.ref);
        });

        await batch.commit();
        console.log("Historial de solicitudes limpiado.");
        // Actualizar la tabla en la página principal
        loadLastRequests();
    } catch (error) {
        console.error("Error limpiando solicitudes:", error);
    }
}

// Funciones de Autenticación

// Evento para el botón de login con Google
btnLoginGoogle.addEventListener('click', async () => {
    try {
        await signInWithPopup(auth, provider);
        // El estado de la interfaz se actualizará automáticamente gracias a onAuthStateChanged
    } catch (error) {
        console.error("Error al iniciar sesión con Google:", error);
        loginStatus.textContent = "Error al iniciar sesión: " + error.message;
    }
});

// Evento para el botón de logout
btnLogout.addEventListener('click', async () => {
    try {
        await signOut(auth);
        // El estado de la interfaz se actualizará automáticamente gracias a onAuthStateChanged
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
        loginStatus.textContent = "Error al cerrar sesión: " + error.message;
    }
});

// Observador de cambios en el estado de autenticación
onAuthStateChanged(auth, (user) => {
    updateUI(user);
});

// Función para actualizar la interfaz basado en el estado de autenticación
function updateUI(user) {
    if (user) {
        // Usuario está autenticado
        loginContainer.style.display = "block";
        btnLoginGoogle.style.display = "none";
        btnLogout.style.display = "block";
        loginStatus.textContent = `Conectado como: ${user.email}`;
        // Verificar si el usuario es el admin
        if (user.email === "cgracia88@gmail.com") {
            // Mostrar el botón de borrar solicitudes
            btnBorrarSolicitudes.style.display = "block";
        } else {
            btnBorrarSolicitudes.style.display = "none";
        }
    } else {
        // Usuario no está autenticado
        loginContainer.style.display = "block";
        btnLoginGoogle.style.display = "block";
        btnLogout.style.display = "none";
        loginStatus.textContent = "";
        // Ocultar el botón de borrar solicitudes
        btnBorrarSolicitudes.style.display = "none";
    }
}

// Evento para el botón de borrar solicitudes (Solo para Admin)
btnBorrarSolicitudes.addEventListener('click', async () => {
    const confirmacion = confirm("¿Estás seguro de que deseas borrar todas las solicitudes?");
    if (confirmacion) {
        await clearSolicitudes();
        alert("Todas las solicitudes han sido eliminadas.");
    }
});

// Cargar las últimas solicitudes al iniciar la página
window.onload = () => {
    loadLastRequests();
};
