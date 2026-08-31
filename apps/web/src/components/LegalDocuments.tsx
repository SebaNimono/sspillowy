import React from 'react';

/** Textos legales públicos (Google OAuth / transparencia). Enlaces: #privacidad #terminos #cookies */
export const LegalPrivacy: React.FC = () => (
  <div className="site-legal-prose">
    <p className="site-legal-meta">
      Última actualización: 30 de agosto de 2026 · Documento aplicable al Web Hub y a la API de SSPILLOWY.
    </p>

    <h3>1. Responsable del tratamiento</h3>
    <p>
      El responsable del tratamiento de los datos personales tratados a través de la plataforma
      <strong> SSPILLOWY</strong> (Software Security Platform for Intelligent, Low-latency Oversight &amp; Warning Yield)
      es el equipo de desarrollo del proyecto académico de titulación asociado a dicha plataforma.
      Para ejercer derechos o formular consultas relacionadas con privacidad, puede utilizar el correo de contacto
      indicado en la pantalla de consentimiento de los proveedores de identidad (Google, Microsoft, GitHub o GitLab)
      o el canal de soporte que el proyecto publique en el sitio web.
    </p>

    <h3>2. Ámbito de aplicación</h3>
    <p>
      La presente Política describe qué datos se recogen, con qué finalidad, durante cuánto tiempo se conservan
      y qué derechos asisten a las personas usuarias del sitio web público, de la consola Web Hub y de los
      servicios de autenticación asociados. El uso de la plataforma implica el conocimiento de esta Política
      y de los <a href="#terminos">Términos y Condiciones</a>.
    </p>

    <h3>3. Datos que tratamos</h3>
    <p>Según el modo de acceso, podemos tratar las siguientes categorías:</p>
    <ul>
      <li>
        <strong>Cuenta con proveedor SSO</strong> (Google, GitHub, GitLab o Microsoft): dirección de correo
        electrónico, nombre o nombre para mostrar y, cuando el proveedor lo facilite, imagen de perfil e
        identificador externo de la cuenta. La autenticación la realiza el proveedor; SSPILLOWY no recibe ni
        almacena la contraseña de Google, Microsoft, GitHub o GitLab.
      </li>
      <li>
        <strong>Cuenta con correo y contraseña</strong>: correo electrónico, nombre indicado por la persona usuaria
        y un hash criptográfico de la contraseña (no se almacena la contraseña en texto claro).
      </li>
      <li>
        <strong>Datos técnicos de sesión</strong>: identificadores de sesión generados tras el inicio de sesión,
        marca temporal de creación y caducidad, y preferencias locales del navegador (por ejemplo, consentimiento
        de cookies o estado de la interfaz).
      </li>
      <li>
        <strong>Datos operativos de la plataforma</strong> (cuando se utilicen módulos de escaneo y auditoría):
        metadatos de repositorios, hallazgos de seguridad, estados de triaje y registros de auditoría asociados
        a la actividad en la consola. Estos datos se tratan para la finalidad de gobernanza de seguridad del software.
      </li>
    </ul>
    <p>
      No solicitamos datos especialmente protegidos (salud, biometría, origen étnico, etc.) para el acceso al Hub.
      La aplicación móvil SSPILLOWY Pulse, si incorpora autenticación biométrica en el dispositivo, tratará esos
      datos según lo indique el sistema operativo y la política específica de dicha aplicación.
    </p>

    <h3>4. Finalidades del tratamiento</h3>
    <ul>
      <li>Permitir el registro, la autenticación y el acceso a la consola Web Hub y servicios asociados.</li>
      <li>Mantener la sesión de usuario y la seguridad del acceso.</li>
      <li>Prestar las funciones de orquestación, visualización y auditoría de hallazgos de seguridad.</li>
      <li>Cumplir obligaciones legales aplicables y atender solicitudes de las personas interesadas.</li>
      <li>Mejorar la estabilidad del servicio (registros técnicos de error o disponibilidad), sin publicidad comportamental.</li>
    </ul>

    <h3>5. Base jurídica</h3>
    <p>
      El tratamiento se basa en la ejecución de la relación de uso de la plataforma (prestación del servicio
      solicitado), en el consentimiento cuando este sea necesario (por ejemplo, preferencias de cookies no esenciales)
      y, en su caso, en el interés legítimo de garantizar la seguridad e integridad del sistema, siempre respetando
      los derechos y libertades de las personas usuarias.
    </p>

    <h3>6. Conservación</h3>
    <p>
      Los datos de cuenta y sesión se conservan mientras la cuenta permanezca activa o sea necesaria para la
      prestación del servicio y, posteriormente, durante los plazos adicionales exigidos por obligaciones legales
      o de seguridad. Las preferencias de cookies se almacenan en el navegador hasta que la persona usuaria las
      modifique o borre los datos del sitio. Los registros técnicos se retienen el tiempo mínimo razonable para
      diagnóstico y seguridad.
    </p>

    <h3>7. Destinatarios y encargados</h3>
    <p>
      Para operar la plataforma utilizamos proveedores de infraestructura y servicios que actúan como encargados
      o como responsables independientes según el caso, entre ellos, a título enunciativo: alojamiento del front-end,
      ejecución de la API, base de datos y proveedores de identidad (Google, GitHub, GitLab, Microsoft). Estos
      proveedores tratan datos conforme a sus propios términos y políticas. No vendemos datos personales ni los
      cedemos a terceros con fines publicitarios.
    </p>

    <h3>8. Transferencias internacionales</h3>
    <p>
      Algunos proveedores pueden situar servidores fuera del país de residencia de la persona usuaria. En esos
      casos, las transferencias se realizan bajo las salvaguardas que ofrezca cada proveedor (cláusulas contractuales
      tipo, políticas de privacidad publicadas u otros mecanismos aplicables).
    </p>

    <h3>9. Cookies y almacenamiento local</h3>
    <p>
      Utilizamos almacenamiento en el navegador estrictamente necesario para el funcionamiento del servicio
      (sesión, preferencia de cookies y, en la consola, preferencias de interfaz). En la actualidad no se emplean
      cookies de publicidad ni redes de analítica de terceros. Puede gestionar su preferencia en la sección de
      <a href="#cookies">Cookies</a> o mediante el aviso de cookies del sitio.
    </p>

    <h3>10. Derechos de las personas usuarias</h3>
    <p>
      Conforme a la normativa aplicable, puede solicitar acceso, rectificación, eliminación, oposición,
      limitación del tratamiento o portabilidad de sus datos personales, así como retirar el consentimiento cuando
      el tratamiento se base en él. Para ejercer estos derechos, contacte a través del correo de asistencia del
      proyecto. También puede presentar una reclamación ante la autoridad de protección de datos competente.
    </p>

    <h3>11. Seguridad</h3>
    <p>
      Aplicamos medidas técnicas y organizativas razonables (cifrado en tránsito mediante HTTPS, hashing de
      contraseñas, control de acceso a la API y separación de entornos). Ningún sistema es absolutamente seguro;
      le recomendamos proteger sus credenciales y cerrar sesión en equipos compartidos.
    </p>

    <h3>12. Menores</h3>
    <p>
      El servicio está dirigido a personas adultas y a equipos profesionales o académicos. No está pensado para
      menores de 14 años (o la edad mínima que exija la legislación local). Si detectamos una cuenta de un menor
      sin base legal adecuada, procederemos a su eliminación.
    </p>

    <h3>13. Cambios</h3>
    <p>
      Podremos actualizar esta Política para reflejar cambios legales o del servicio. La fecha de «Última actualización»
      se revisará en cada modificación sustancial. El uso continuado del servicio tras la publicación implica el
      conocimiento de la versión vigente.
    </p>
  </div>
);

export const LegalTerms: React.FC = () => (
  <div className="site-legal-prose">
    <p className="site-legal-meta">
      Última actualización: 30 de agosto de 2026 · Condiciones de uso del Web Hub y la API de SSPILLOWY.
    </p>

    <h3>1. Aceptación</h3>
    <p>
      Al acceder o utilizar SSPILLOWY (sitio web, consola Web Hub, API u otros componentes publicados por el
      proyecto), usted acepta estos Términos y Condiciones y la <a href="#privacidad">Política de Privacidad</a>.
      Si no está de acuerdo, no utilice el servicio.
    </p>

    <h3>2. Descripción del servicio</h3>
    <p>
      SSPILLOWY es una plataforma de gobernanza DevSecOps orientada a orquestar análisis de seguridad de software,
      unificar hallazgos, apoyar el triaje con asistencia de IA bajo supervisión humana (human-in-the-loop) y
      facilitar la auditoría desde una consola web. El proyecto tiene carácter académico / de demostración en su
      etapa actual; determinadas funciones pueden estar en desarrollo, usar datos de demostración o presentar
      limitaciones de disponibilidad.
    </p>

    <h3>3. Cuentas y acceso</h3>
    <ul>
      <li>Puede autenticarse mediante proveedores SSO (Google, GitHub, GitLab, Microsoft) o mediante registro con correo y contraseña, según las opciones habilitadas.</li>
      <li>Usted es responsable de la confidencialidad de sus credenciales y de la actividad realizada con su cuenta.</li>
      <li>El proyecto puede suspender o cancelar el acceso ante uso indebido, riesgo de seguridad o incumplimiento de estos Términos.</li>
      <li>Las cuentas creadas solo con SSO no disponen de contraseña en SSPILLOWY hasta que la persona usuaria la defina mediante el registro con el mismo correo, si dicha función está disponible.</li>
    </ul>

    <h3>4. Uso permitido</h3>
    <p>Usted se compromete a utilizar el servicio de forma lícita y de buena fe, y en particular a:</p>
    <ul>
      <li>No intentar acceder a sistemas, datos o cuentas ajenas sin autorización.</li>
      <li>No utilizar la plataforma para escanear, atacar o comprometer sistemas de terceros sin permiso explícito.</li>
      <li>No sobrecargar deliberadamente la infraestructura ni eludir medidas de seguridad.</li>
      <li>No introducir malware, contenido ilícito o material que infrinja derechos de terceros.</li>
      <li>Respetar las leyes aplicables, incluidas las relativas a protección de datos y ciberseguridad.</li>
    </ul>

    <h3>5. Contenido y repositorios</h3>
    <p>
      Si conecta repositorios o aporta información a la plataforma, declara disponer de los derechos o autorizaciones
      necesarios. Usted conserva la titularidad de su código y datos; SSPILLOWY los trata únicamente para prestar
      el servicio. Los hallazgos de seguridad generados son resultados técnicos orientativos y no constituyen
      asesoramiento legal ni certificación de cumplimiento.
    </p>

    <h3>6. Inteligencia artificial y decisión humana</h3>
    <p>
      Cualquier sugerencia, puntuación o propuesta de remediación generada por componentes de IA tiene carácter
      auxiliar. La validación, aceptación de riesgo, marcado de falso positivo o cierre de hallazgos corresponde
      a personas autorizadas. SSPILLOWY no garantiza la exactitud absoluta de los modelos ni de los motores de detección.
    </p>

    <h3>7. Disponibilidad y cambios del servicio</h3>
    <p>
      El servicio se ofrece «tal cual» y «según disponibilidad». Podremos modificar, suspender o discontinuar
      funciones, realizar mantenimientos o limitar el uso gratuito. No garantizamos un nivel de servicio (SLA)
      concreto salvo acuerdo escrito distinto.
    </p>

    <h3>8. Propiedad intelectual</h3>
    <p>
      Los signos distintivos, el diseño de la interfaz, la documentación y el software de SSPILLOWY pertenecen a
      sus respectivos titulares. Queda prohibida la reproducción no autorizada fuera del uso legítimo del servicio
      o de las licencias open source aplicables a componentes de terceros.
    </p>

    <h3>9. Limitación de responsabilidad</h3>
    <p>
      En la máxima medida permitida por la ley, el equipo del proyecto no será responsable de daños indirectos,
      lucro cesante, pérdida de datos o interrupciones del negocio derivados del uso o la imposibilidad de uso
      del servicio, ni de decisiones tomadas exclusivamente sobre la base de hallazgos automatizados. El uso en
      entornos productivos críticos se realiza bajo la exclusiva responsabilidad de la organización usuaria.
    </p>

    <h3>10. Enlaces y servicios de terceros</h3>
    <p>
      El servicio puede integrar o redirigir a sitios y autenticadores de terceros. Esos servicios se rigen por
      sus propias condiciones. SSPILLOWY no controla ni asume responsabilidad por el contenido o las prácticas
      de privacidad de terceros.
    </p>

    <h3>11. Legislación y disputas</h3>
    <p>
      Estos Términos se interpretan de conformidad con la legislación aplicable en la República de Chile, sin
      perjuicio de normas imperativas del lugar de residencia de la persona usuaria. Ante controversias, las partes
      procurarán una solución amistosa antes de acudir a los tribunales competentes.
    </p>

    <h3>12. Contacto</h3>
    <p>
      Para cuestiones relativas a estos Términos o a la plataforma, utilice el correo de asistencia del proyecto
      publicado en la configuración OAuth / pantalla de consentimiento, o el canal de contacto indicado en el sitio web.
    </p>
  </div>
);

export const LegalCookies: React.FC = () => (
  <div className="site-legal-prose">
    <p className="site-legal-meta">Última actualización: 30 de agosto de 2026</p>
    <h3>Cookies y almacenamiento local</h3>
    <p>
      SSPILLOWY utiliza almacenamiento en el navegador (localStorage / preferencias) con las siguientes finalidades:
    </p>
    <ul>
      <li>
        <strong>Necesarias:</strong> mantener la sesión de la consola tras el inicio de sesión, recordar la
        preferencia de cookies y preferencias de interfaz (por ejemplo, sidebar). Sin ellas el Hub no puede
        funcionar correctamente.
      </li>
      <li>
        <strong>Opcionales:</strong> en la versión actual no se cargan scripts de publicidad ni de analítica de
        terceros. Si en el futuro se incorporan, se solicitará consentimiento previo y se actualizará esta sección.
      </li>
    </ul>
    <p>
      Puede cambiar su preferencia en cualquier momento mediante el botón siguiente o el enlace «Cookies» del pie
      de página. También puede borrar los datos del sitio desde la configuración de su navegador.
    </p>
  </div>
);
