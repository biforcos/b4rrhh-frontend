export const appTexts = {
  brandName: 'B4RRHH',
  brandHomeAriaLabel: 'Ir a inicio',
  navigationAriaLabel: 'Navegación principal de la aplicación',
  authCurrentSubjectLabel: 'Sesión local',
  authLogoutAction: 'Cerrar sesión',
  authLoginTitle: 'Acceso local de desarrollo',
  authLoginDescription:
    'Introduce un subject local para solicitar un token dev y seguir trabajando contra el backend securizado.',
  authSubjectLabel: 'Subject',
  authSubjectPlaceholder: 'bifor',
  authSubjectHelpPrefix: 'Subjects locales disponibles de ejemplo:',
  authLoginSubmitAction: 'Entrar',
  authLoginSubmittingAction: 'Entrando...',
  authLoginErrorMessage: 'No se pudo obtener un token local. Revisa el subject o el backend local.',
  authLoginInvalidSubjectMessage: 'El subject es obligatorio.',

  // --- Demo publica ---
  demoLoginTitle: 'B4RRHH · demo',
  demoLoginIntro:
    'Un ERP de nómina y recursos humanos. Esto es una demostración abierta: los datos son sintéticos y no corresponden a ninguna persona real.',
  demoLoginInviteTitle: 'Puedes tocar lo que quieras',
  demoLoginInvite:
    'Contrata, da de baja, recontrata, cambia contratos. Los datos se regeneran periódicamente, así que no hay nada que romper.',
  demoProfileLabel: 'Perfil',
  demoPasswordLabel: 'Contraseña',
  demoPasswordHint: 'Ya está puesta. Está a la vista a propósito: la demo es para que entres.',
  demoLoginSubmitAction: 'Entrar en la demo',
  demoLoginSubmittingAction: 'Entrando...',
  demoLoginErrorMessage: 'No se pudo entrar. Revisa el perfil y la contraseña.',
  demoLoginInvalidMessage: 'Elige un perfil e introduce la contraseña.',
  demoRolesLabel: 'Permisos:',
  // --- Ámbito (el sistema de reglas activo, ADR-049) ---
  scopeLabel: 'Ámbito',
  scopeSingleHint: 'El ámbito todavía no se puede cambiar: ninguna pantalla lo consume',
  scopeUnavailable: 'Sin ámbito',

  // --- Navegación: los cuatro grupos (ADR-049) ---
  groupEmployees: 'Empleados',
  groupOrganization: 'Organización',
  groupSociety: 'Sociedad',
  groupPayroll: 'Nóminas',
  sectionGeneral: 'General',
  sectionHome: 'Inicio',
  sectionEmployees: 'Empleados',
  sectionDirectory: 'Directorio',
  sectionCompanies: 'Empresas',
  sectionWorkCenters: 'Centros de trabajo',
  /**
   * «Catálogos», la palabra del ADR-053: lo que ahí vive es código y literal. El menú
   * decía «Maestros» y la pantalla «Catálogos» (frontend#22); se queda la del modelo y
   * el menú y el título dicen lo mismo (frontend#33). «Centros de coste» ya no tiene
   * entrada propia: sin extensiones declaradas, su sitio es Catálogos.
   */
  sectionCatalogs: 'Catálogos',
  sectionAgreements: 'Convenios',
  sectionRuleSystems: 'Sistemas de reglas',
  sectionRecibos: 'Recibos',
  sectionOperaciones: 'Operaciones',
  sectionDesigner: 'Diseñador de nómina',
  homeTitle: 'Inicio',
  homeDescription:
    'Aplicación de administración de personal preparada para crecer por secciones funcionales.',
  homeEmployeesShortcut: 'Ir a Empleados',
  placeholderTitleSuffix: 'en construcción',
} as const;
