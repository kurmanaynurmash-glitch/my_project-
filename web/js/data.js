/*
 * Kazakhstan universities and their faculties.
 *
 * Faculty names come from each university's public pages (Nazarbayev University,
 * Al-Farabi KazNU, L.N. Gumilyov ENU, Abai KazNPU, Asfendiyarov KazNMU, SDU, KIMEP,
 * KazUTB) and may change. KBTU's list is incomplete. They are shown in English,
 * the way the universities publish them. Please re-check them against the official
 * sites before relying on them, and extend this list as needed.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StudyData = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var UNIVERSITIES = [
    {
      id: 'nu', short: 'NU',
      kk: 'Назарбаев Университеті', en: 'Nazarbayev University',
      faculties: [
        'Center for Preparatory Studies', 'School of Sciences and Humanities',
        'School of Computing and Artificial Intelligence', 'School of Engineering',
        'School of Medicine', 'Graduate School of Business', 'Graduate School of Education',
        'Graduate School of Public Policy'
      ]
    },
    {
      id: 'kaznu', short: 'KazNU',
      kk: 'Әл-Фараби атындағы Қазақ ұлттық университеті', en: 'Al-Farabi Kazakh National University',
      faculties: [
        'Faculty of Biology and Biotechnology', 'Faculty of Physics and Technology',
        'Faculty of Chemistry and Chemical Technology', 'Faculty of Philology and World Languages',
        'Faculty of Journalism', 'Faculty of Information Technology',
        'Faculty of History, Archaeology and Ethnology', 'Faculty of Philosophy and Political Science',
        'Faculty of Law', 'Faculty of Oriental Studies', 'Faculty of International Relations',
        'Faculty of Mechanics and Mathematics', 'Faculty of Geography and Environmental Sciences',
        'Higher School of Economics and Business', 'Higher School of Medicine'
      ]
    },
    {
      id: 'enu', short: 'ENU',
      kk: 'Л.Н. Гумилев атындағы Еуразия ұлттық университеті', en: 'L.N. Gumilyov Eurasian National University',
      faculties: [
        'School of Information Technologies', 'School of Natural Sciences', 'School of Economics',
        'School of Philology', 'School of Law', 'School of Mechanics and Mathematics',
        'School of Journalism and Political Science', 'School of Transport and Energy',
        'School of Architecture and Construction', 'School of International Relations',
        'School of Physics and Technical Sciences', 'School of Social Sciences', 'School of History'
      ]
    },
    {
      id: 'abai', short: 'Abai KazNPU',
      kk: 'Абай атындағы Қазақ ұлттық педагогикалық университеті', en: 'Abai Kazakh National Pedagogical University',
      faculties: [
        'Philological faculty', 'Faculty of Physics and Mathematics', 'Faculty of History',
        'Faculty of Eco-Geology', 'Faculty of Bio-Chemistry', 'Faculty of Psychology',
        'Faculty of Arts', 'Faculty of Economic Sciences', 'Faculty of International Relations'
      ]
    },
    {
      id: 'kaznmu', short: 'KazNMU',
      kk: 'С.Ж. Асфендияров атындағы Қазақ ұлттық медицина университеті', en: 'Asfendiyarov Kazakh National Medical University',
      faculties: [
        'General medicine faculty', 'Therapeutic faculty', 'Faculty of pediatrics',
        'Medico-prophylactic faculty', 'Stomatology faculty', 'Pharmacy faculty',
        'Faculty of management in Public Health and Pharmacy'
      ]
    },
    {
      id: 'sdu', short: 'SDU',
      kk: 'SDU University', en: 'SDU University',
      faculties: [
        'Faculty of Law and Social Sciences', 'Faculty of Engineering and Natural Sciences',
        'Faculty of Education and Humanities', 'SDU Business School',
        'School of Information Technologies and Applied Mathematics'
      ]
    },
    {
      id: 'kbtu', short: 'KBTU',
      kk: 'Қазақстан-Британ техникалық университеті', en: 'Kazakh-British Technical University',
      faculties: [
        'School of Energy and Oil and Gas Products', 'Kazakhstan Maritime Academy',
        'School of Applied Mathematics', 'School of Natural and Social Sciences',
        'Business School', 'International School of Economics'
      ]
    },
    {
      id: 'kimep', short: 'KIMEP',
      kk: 'KIMEP University', en: 'KIMEP University',
      faculties: [
        'Bang College of Business', 'College of Social Sciences', 'School of Law',
        'College of Human Sciences and Education'
      ]
    },
    {
      id: 'kazutb', short: 'KazUTB',
      kk: 'Қ. Құлажанов атындағы Қазақ технология және бизнес университеті', en: 'Kazakh University of Technology and Business',
      faculties: [
        'Faculty of Technology', 'Faculty of Economics and Business',
        'Faculty of Engineering and Information Technology'
      ]
    }
  ];

  // Rough study area of a faculty, used to pick example tasks. "hum" is the fallback.
  function fieldOf(faculty) {
    var f = String(faculty || '');
    if (/medic|pharm|stomat|pediatr|prophyl|health/i.test(f)) return 'med';
    if (/law|business|econom|social|philolog|journal|histor|educat|human|\barts?\b|international|political|philosoph|psycholog|oriental|policy|management/i.test(f)) return 'hum';
    if (/engineer|technolog|computing|information|mathemat|physic|chemi|natural|science|geograph|mechanic|energy|oil|applied|transport|architect|biolog|eco-geo|bio-chem|maritime/i.test(f)) return 'stem';
    return 'hum';
  }

  return { UNIVERSITIES: UNIVERSITIES, fieldOf: fieldOf };
});
