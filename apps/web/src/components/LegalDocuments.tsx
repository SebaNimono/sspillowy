import React from 'react';

/** Textos legales públicos. Rutas: /privacidad /terminos /cookies */
export const LegalPrivacy: React.FC = () => (
  <div className="site-legal-prose">
    <p className="site-legal-meta">
      Última actualización: 15 de octubre de 2026 · Aplica al sitio público, al Web Hub, a la API y a la app móvil
      Pulse cuando esté conectada a SSPILLOWY.
    </p>

    <h3>1. Quién es responsable</h3>
    <p>
      El responsable del tratamiento de los datos personales en <strong>SSPILLOWY</strong> es el equipo del proyecto
      académico Capstone asociado a la plataforma. Para consultas o ejercicio de derechos, use el correo de contacto
      publicado en la pantalla de consentimiento del proveedor de identidad (Google, Microsoft, GitHub o GitLab) o el
      canal de soporte indicado en el sitio.
    </p>

    <h3>2. Qué datos tratamos</h3>
    <ul>
      <li>
        <strong>Cuenta SSO</strong> (Google, GitHub, GitLab o Microsoft): correo, nombre para mostrar e, si el
        proveedor lo envía, foto e identificador externo. No recibimos ni guardamos la contraseña de esos proveedores.
      </li>
      <li>
        <strong>Cuenta con correo y contraseña</strong>: correo, nombre y un hash de la contraseña (nunca en texto
        claro).
      </li>
      <li>
        <strong>Sesión y preferencias</strong>: identificador de sesión, caducidad y preferencias del navegador
        (cookies, idioma, interfaz).
      </li>
      <li>
        <strong>Espacios de trabajo</strong>: nombre del espacio, miembros, roles y datos aislados por organización
        (repositorios, análisis, hallazgos, excepciones del Security Gate, SBOM, secretos y auditoría).
      </li>
      <li>
        <strong>Operación de seguridad</strong>: metadatos de repositorios, resultados de motores de detección,
        estados de triaje y bitácora de acciones. Sirven para gobernar la seguridad del software, no para publicidad.
      </li>
    </ul>
    <p>
      No pedimos datos sensibles (salud, biometría, origen étnico, etc.) para entrar al Hub. Si Pulse usa huella o
      rostro en el teléfono, eso lo gestiona el sistema operativo del dispositivo, no nuestros servidores.
    </p>

    <h3>3. Para qué los usamos</h3>
    <ul>
      <li>Registrar, autenticar y mantener el acceso a la consola y a la API.</li>
      <li>Aislar los datos de cada espacio de trabajo y aplicar roles (propietario, administrador, miembro, lector).</li>
      <li>Ejecutar análisis, mostrar hallazgos, Security Gates, cumplimiento y alertas.</li>
      <li>Asistir el triaje con Pillow; las decisiones las toma siempre una persona.</li>
      <li>Cumplir obligaciones legales y atender solicitudes de las personas usuarias.</li>
      <li>Mantener la estabilidad del servicio (registros técnicos), sin publicidad comportamental.</li>
    </ul>

    <h3>4. Base jurídica</h3>
    <p>
      Tratamos los datos para prestar el servicio que usted solicita, con su consentimiento cuando haga falta
      (por ejemplo, cookies no esenciales) y, cuando corresponda, por el interés legítimo de proteger la seguridad
      de la plataforma, respetando sus derechos.
    </p>

    <h3>5. Cuánto tiempo los guardamos</h3>
    <p>
      Los datos de cuenta y de los espacios se conservan mientras la cuenta o el espacio estén activos y, después,
      solo el tiempo que exijan la ley o la seguridad. Las preferencias de cookies viven en su navegador hasta que
      las cambie o borre los datos del sitio. Los registros técnicos se retienen el mínimo razonable.
    </p>

    <h3>6. Con quién se comparten</h3>
    <p>
      Usamos proveedores de infraestructura (alojamiento web, API, base de datos) y de identidad (Google, GitHub,
      GitLab, Microsoft). Cada uno trata datos según su propia política. No vendemos datos personales ni los cedemos
      con fines publicitarios.
    </p>

    <h3>7. Transferencias internacionales</h3>
    <p>
      Algunos proveedores pueden operar servidores fuera de Chile. En ese caso aplican las salvaguardas que ofrezca
      cada proveedor (cláusulas contractuales tipo u otros mecanismos equivalentes).
    </p>

    <h3>8. Cookies y almacenamiento local</h3>
    <p>
      Solo usamos almacenamiento necesario para la sesión, la preferencia de cookies y la interfaz. Hoy no hay
      cookies de publicidad ni analítica de terceros. Puede gestionar su preferencia en{' '}
      <a href="/cookies">Cookies</a>.
    </p>

    <h3>9. Sus derechos</h3>
    <p>
      Puede pedir acceso, rectificación, eliminación, oposición, limitación o portabilidad de sus datos, y retirar
      el consentimiento cuando el tratamiento se base en él. Contáctenos por el correo de asistencia del proyecto.
      También puede reclamar ante la autoridad de protección de datos competente.
    </p>

    <h3>10. Seguridad</h3>
    <p>
      Aplicamos HTTPS, hashing de contraseñas, aislamiento por espacio de trabajo, cifrado de tokens de repositorios
      privados y control de acceso a la API. Ningún sistema es absolutamente seguro: proteja sus credenciales y cierre
      sesión en equipos compartidos.
    </p>

    <h3>11. Menores</h3>
    <p>
      El servicio está pensado para personas adultas y equipos profesionales o académicos. No está dirigido a menores
      de 14 años (o la edad mínima que exija la ley local).
    </p>

    <h3>12. Cambios</h3>
    <p>
      Podemos actualizar esta Política. La fecha de «Última actualización» cambia en cada modificación sustancial.
      El uso continuado del servicio implica conocer la versión vigente. Ver también los{' '}
      <a href="/terminos">Términos y Condiciones</a>.
    </p>
  </div>
);

export const LegalTerms: React.FC = () => (
  <div className="site-legal-prose">
    <p className="site-legal-meta">
      Última actualización: 15 de octubre de 2026 · Condiciones de uso del sitio, Web Hub, API y Pulse conectado a
      SSPILLOWY.
    </p>

    <h3>1. Aceptación</h3>
    <p>
      Al usar SSPILLOWY acepta estos Términos y la <a href="/privacidad">Política de Privacidad</a>. Si no está de
      acuerdo, no utilice el servicio.
    </p>

    <h3>2. Qué es SSPILLOWY</h3>
    <p>
      SSPILLOWY es una plataforma de gobernanza DevSecOps que orquesta análisis de seguridad (SAST, secretos, SCA/IaC
      y DAST), unifica hallazgos, aplica Security Gates en el despliegue, apoya el triaje con Pillow bajo supervisión
      humana y permite gestionar el trabajo por espacios privados. El proyecto tiene carácter académico y de
      demostración; algunas funciones pueden estar en desarrollo o tener límites de disponibilidad.
    </p>

    <h3>3. Cuentas y espacios</h3>
    <ul>
      <li>Puede entrar con SSO (Google, GitHub, GitLab, Microsoft) o con correo y contraseña, según lo habilitado.</li>
      <li>Usted es responsable de sus credenciales y de la actividad de su cuenta.</li>
      <li>
        Los datos de cada espacio de trabajo son privados para sus miembros. El propietario y los administradores
        gestionan personas, roles y la política del Security Gate.
      </li>
      <li>Podemos suspender el acceso ante uso indebido, riesgo de seguridad o incumplimiento de estos Términos.</li>
    </ul>

    <h3>4. Uso permitido</h3>
    <p>Se compromete a usar el servicio de forma lícita y, en particular, a:</p>
    <ul>
      <li>No acceder a cuentas, espacios o datos ajenos sin autorización.</li>
      <li>No escanear ni atacar sistemas de terceros sin permiso explícito.</li>
      <li>No sobrecargar la infraestructura ni eludir medidas de seguridad.</li>
      <li>No introducir malware, contenido ilícito ni material que infrinja derechos de terceros.</li>
      <li>Respetar la legislación aplicable, incluida la de protección de datos y ciberseguridad.</li>
    </ul>

    <h3>5. Repositorios y hallazgos</h3>
    <p>
      Si conecta repositorios, declara tener derecho a hacerlo. Usted conserva la titularidad de su código; SSPILLOWY
      lo trata solo para prestar el servicio. Los hallazgos son resultados técnicos orientativos: no son asesoramiento
      legal ni certificación de cumplimiento.
    </p>

    <h3>6. Inteligencia artificial (Pillow)</h3>
    <p>
      Las propuestas de Pillow (priorización, explicación o remediación) son auxiliares. Aceptar, rechazar o marcar
      un hallazgo corresponde siempre a una persona autorizada. No garantizamos exactitud absoluta de los modelos ni
      de los motores de detección.
    </p>

    <h3>7. Disponibilidad</h3>
    <p>
      El servicio se ofrece «tal cual» y según disponibilidad. Podemos modificar o suspender funciones, hacer
      mantenimientos o limitar el uso. No hay SLA salvo acuerdo escrito distinto.
    </p>

    <h3>8. Propiedad intelectual</h3>
    <p>
      Marcas, interfaz, documentación y software de SSPILLOWY pertenecen a sus titulares. Queda prohibida la
      reproducción no autorizada fuera del uso legítimo del servicio o de las licencias open source de terceros.
    </p>

    <h3>9. Limitación de responsabilidad</h3>
    <p>
      En la medida permitida por la ley, el equipo del proyecto no responde por daños indirectos, lucro cesante,
      pérdida de datos o interrupciones derivados del uso del servicio, ni por decisiones tomadas solo a partir de
      hallazgos automatizados. El uso en entornos productivos críticos es responsabilidad de la organización usuaria.
    </p>

    <h3>10. Servicios de terceros</h3>
    <p>
      Autenticadores, alojamiento, motores de escaneo y otras integraciones se rigen por sus propias condiciones.
      SSPILLOWY no controla esas prácticas.
    </p>

    <h3>11. Legislación</h3>
    <p>
      Estos Términos se interpretan conforme a la legislación de la República de Chile, sin perjuicio de normas
      imperativas del lugar de residencia de la persona usuaria. Ante controversias, se buscará primero una solución
      amistosa.
    </p>

    <h3>12. Contacto</h3>
    <p>
      Para dudas sobre estos Términos o la plataforma, use el correo de asistencia del proyecto (pantalla de
      consentimiento OAuth) o el canal de contacto del sitio.
    </p>
  </div>
);

export const LegalCookies: React.FC = () => (
  <div className="site-legal-prose">
    <p className="site-legal-meta">Última actualización: 15 de octubre de 2026</p>
    <h3>Cookies y almacenamiento local</h3>
    <p>SSPILLOWY usa almacenamiento en el navegador con estas finalidades:</p>
    <ul>
      <li>
        <strong>Necesarias:</strong> sesión de la consola, espacio de trabajo activo, preferencia de cookies e
        interfaz. Sin ellas el Hub no funciona bien.
      </li>
      <li>
        <strong>Opcionales:</strong> hoy no cargamos publicidad ni analítica de terceros. Si se agregan, pediremos
        consentimiento y actualizaremos esta sección.
      </li>
    </ul>
    <p>
      Puede cambiar su preferencia con el botón de abajo o el enlace «Cookies» del pie. También puede borrar los datos
      del sitio desde la configuración del navegador.
    </p>
  </div>
);
