// Real club and player NAMES are public facts. Every rating is an original APEX estimate.
// Squads updated 3 October 2026 from completed 2026 summer deals. 18-man lists, not full squads.
// Squad line: Name|POS|OVR|COUNTRY|AGE  (order: 2 GK, 6 DEF, 6 MID, 4 ATT)
export const LEAGUES = { EPL: 'Premier League', LALIGA: 'La Liga', SERIEA: 'Serie A', BUNDES: 'Bundesliga' };

const C = (key, name, short, league, stadium, crest, kit, squad) => ({ key, name, short, league, stadium, crest, kit: { shirt: kit[0], shorts: kit[1], number: kit[2] }, squad });

export const CLUBS = [
  C('mancity', 'Manchester City', 'MCI', 'EPL', 'Etihad Stadium', ['#6CABDD', '#FFFFFF'], ['#6CABDD', '#FFFFFF', '#0B1C33'], `
Gianluigi Donnarumma|GK|86|ITA|27
Geronimo Rulli|GK|80|ARG|34
Josko Gvardiol|CB|85|CRO|24
Ruben Dias|CB|86|POR|29
Rayan Ait-Nouri|LB|80|ALG|25
Matheus Nunes|RB|80|POR|27
Abdukodir Khusanov|CB|78|UZB|22
Vitor Reis|CB|76|BRA|20
Enzo Fernandez|CM|86|ARG|25
Elliot Anderson|CM|84|ENG|23
Ayyoub Bouaddi|CDM|82|FRA|18
Phil Foden|CAM|86|ENG|26
Rico Lewis|CM|77|ENG|21
Allan|CM|79|BRA|22
Erling Haaland|ST|92|NOR|26
Jeremy Doku|LW|83|BEL|24
Iliman Ndiaye|RW|82|SEN|26
Oscar Bobb|RW|78|NOR|23`),
  C('arsenal', 'Arsenal', 'ARS', 'EPL', 'Emirates Stadium', ['#EF0107', '#FFFFFF'], ['#EF0107', '#FFFFFF', '#FFFFFF'], `
David Raya|GK|86|ESP|30
Illan Meslier|GK|78|FRA|26
William Saliba|CB|88|FRA|25
Gabriel Magalhaes|CB|87|BRA|28
Ben White|RB|82|ENG|28
Riccardo Calafiori|LB|82|ITA|24
Jurrien Timber|RB|83|NED|25
Ezri Konsa|CB|82|ENG|28
Declan Rice|CDM|89|ENG|27
Martin Zubimendi|CDM|85|ESP|27
Martin Odegaard|CAM|88|NOR|27
Bruno Guimaraes|CM|86|BRA|29
Eberechi Eze|CAM|83|ENG|28
Mikel Merino|CM|82|ESP|30
Bukayo Saka|RW|90|ENG|25
Viktor Gyokeres|ST|86|SWE|28
Kai Havertz|ST|83|GER|27
Christos Tzolis|LW|79|GRE|24`),
  C('liverpool', 'Liverpool', 'LIV', 'EPL', 'Anfield', ['#C8102E', '#F6EB61'], ['#C8102E', '#C8102E', '#FFFFFF'], `
Alisson|GK|89|BRA|33
Giorgi Mamardashvili|GK|82|GEO|25
Virgil van Dijk|CB|88|NED|35
Milos Kerkez|LB|79|HUN|22
Jeremie Frimpong|RB|82|NED|25
Conor Bradley|RB|80|NIR|22
Jeremy Jacquet|CB|80|FRA|21
Konstantinos Tsimikas|LB|77|GRE|30
Ryan Gravenberch|CDM|86|NED|24
Alexis Mac Allister|CM|85|ARG|27
Dominik Szoboszlai|CAM|85|HUN|25
Florian Wirtz|CAM|87|GER|23
Wataru Endo|CDM|76|JPN|33
Victor Munoz|CM|78|ESP|22
Alexander Isak|ST|87|SWE|27
Cody Gakpo|LW|84|NED|27
Hugo Ekitike|ST|82|FRA|24
Bradley Barcola|LW|86|FRA|23`),
  C('chelsea', 'Chelsea', 'CHE', 'EPL', 'Stamford Bridge', ['#034694', '#FFFFFF'], ['#034694', '#FFFFFF', '#FFFFFF'], `
Emiliano Martinez|GK|86|ARG|33
Robert Sanchez|GK|79|ESP|28
Levi Colwill|CB|82|ENG|23
Wesley Fofana|CB|80|FRA|25
Reece James|RB|84|ENG|26
Malo Gusto|RB|80|FRA|23
Valentin Barco|LB|78|ARG|21
Maxence Lacroix|CB|81|FRA|26
Moises Caicedo|CDM|86|ECU|24
Cole Palmer|CAM|89|ENG|24
Morgan Rogers|CAM|85|ENG|24
Romeo Lavia|CDM|79|BEL|22
Jordan Henderson|CM|76|ENG|36
Geovany Quenda|RW|80|POR|19
Joao Pedro|ST|83|BRA|24
Estevao|RW|80|BRA|19
Danny Welbeck|ST|77|ENG|35
Emmanuel Emegha|ST|76|NED|21`),
  C('manutd', 'Manchester United', 'MUN', 'EPL', 'Old Trafford', ['#DA291C', '#FBE122'], ['#DA291C', '#FFFFFF', '#FFFFFF'], `
Senne Lammens|GK|79|BEL|23
Karl Darlow|GK|74|ENG|35
Lisandro Martinez|CB|83|ARG|28
Matthijs de Ligt|CB|82|NED|26
Leny Yoro|CB|79|FRA|20
Diogo Dalot|RB|80|POR|27
Luke Shaw|LB|79|ENG|31
Patrick Dorgu|LB|77|DEN|21
Bruno Fernandes|CAM|87|POR|31
Youri Tielemans|CM|83|BEL|29
Carlos Baleba|CDM|81|CMR|22
Andrey Santos|CM|79|BRA|22
Kobbie Mainoo|CM|80|ENG|21
Manuel Ugarte|CDM|79|URU|25
Matheus Cunha|CAM|83|BRA|27
Bryan Mbeumo|RW|84|CMR|27
Benjamin Sesko|ST|82|SVN|23
Amad Diallo|RW|81|CIV|24`),
  C('tottenham', 'Tottenham Hotspur', 'TOT', 'EPL', 'Tottenham Hotspur Stadium', ['#132257', '#FFFFFF'], ['#FFFFFF', '#132257', '#132257'], `
Guglielmo Vicario|GK|82|ITA|29
Martin Dubravka|GK|76|SVK|37
Micky van de Ven|CB|84|NED|25
Jan Paul van Hecke|CB|80|NED|26
Pedro Porro|RB|82|ESP|26
Destiny Udogie|LB|80|ITA|23
Kevin Danso|CB|78|AUT|27
Andy Robertson|LB|80|SCO|32
Sandro Tonali|CDM|85|ITA|26
James Maddison|CAM|84|ENG|29
Xavi Simons|CAM|83|NED|23
Mateus Fernandes|CM|80|POR|21
Rodrigo Bentancur|CM|81|URU|29
Lucas Bergvall|CM|78|SWE|20
Savinho|RW|81|BRA|22
Omar Marmoush|RW|84|EGY|27
Mohammed Kudus|RW|83|GHA|25
Dominic Solanke|ST|82|ENG|28`),
  C('newcastle', 'Newcastle United', 'NEW', 'EPL', "St James' Park", ['#241F20', '#FFFFFF'], ['#FFFFFF', '#241F20', '#241F20'], `
Nick Pope|GK|79|ENG|34
Aaron Ramsdale|GK|79|ENG|28
Sven Botman|CB|82|NED|26
Fabian Schar|CB|80|SUI|34
Dan Burn|CB|78|ENG|34
Tino Livramento|RB|80|ENG|23
Lewis Hall|LB|79|ENG|21
Malick Thiaw|CB|80|GER|24
Joelinton|CM|82|BRA|29
Nico Gonzalez|CDM|80|ESP|24
Joe Willock|CM|76|ENG|26
Jacob Ramsey|CM|77|ENG|25
Lewis Miley|CM|74|ENG|20
Sean Steur|CM|75|NED|22
Matias Fernandez-Pardo|LW|80|ARG|21
Harvey Barnes|LW|80|ENG|28
Yoane Wissa|ST|80|COD|29
Bazoumana Toure|RW|78|CIV|20`),
  C('astonvilla', 'Aston Villa', 'AVL', 'EPL', 'Villa Park', ['#670E36', '#95BFE5'], ['#670E36', '#FFFFFF', '#95BFE5'], `
Zion Suzuki|GK|76|JPN|24
Marco Bizot|GK|74|NED|34
Pau Torres|CB|82|ESP|29
Taylor Harwood-Bellis|CB|78|ENG|24
Matty Cash|RB|80|POL|29
Ian Maatsen|LB|78|NED|24
Tyrone Mings|CB|76|ENG|33
Aaron Wan-Bissaka|RB|78|ENG|28
John McGinn|CM|80|SCO|31
Boubacar Kamara|CDM|83|FRA|26
Leon Goretzka|CM|80|GER|31
Joao Gomes|CM|80|BRA|25
Amadou Onana|CDM|81|BEL|24
Emiliano Buendia|CAM|78|ARG|29
Nicolas Jackson|ST|81|SEN|25
Alejandro Garnacho|LW|80|ARG|22
Ibrahim Mbaye|RW|77|SEN|18
Johan Manzambi|CAM|78|SUI|21`),
  C('brighton', 'Brighton & Hove Albion', 'BHA', 'EPL', 'Amex Stadium', ['#0057B8', '#FFFFFF'], ['#0057B8', '#FFFFFF', '#FFFFFF'], `
Bart Verbruggen|GK|79|NED|23
Jason Steele|GK|72|ENG|35
Lewis Dunk|CB|78|ENG|34
Pascal Struijk|CB|78|NED|27
Pervis Estupinan|LB|79|ECU|28
Ferdi Kadioglu|LB|79|TUR|26
Jaouen Hadjam|LB|75|FRA|22
Luka Vuskovic|CB|76|CRO|19
Yasin Ayari|CM|77|SWE|22
Georginio Rutter|CAM|78|FRA|24
Matt O'Riley|CM|78|DEN|25
Diego Gomez|CM|76|PAR|23
Jack Hinshelwood|CM|76|ENG|21
Chema Andres|CM|76|ESP|21
Kaoru Mitoma|LW|80|JPN|29
Yankuba Minteh|RW|77|GAM|21
Femi Azeez|RW|74|NGA|25
Promise David|ST|74|CAN|24`),
  C('westham', 'West Ham United', 'WHU', 'EPL', 'London Stadium', ['#7A263A', '#1BB1E7'], ['#7A263A', '#FFFFFF', '#1BB1E7'], `
Alphonse Areola|GK|79|FRA|33
Mads Hermansen|GK|77|DEN|25
Jean-Clair Todibo|CB|80|FRA|26
Max Kilman|CB|79|ENG|29
Konstantinos Mavropanos|CB|77|GRE|28
Kyle Walker-Peters|RB|75|ENG|29
Joel Veltman|RB|74|NED|34
Oliver Scarles|LB|73|ENG|20
Lucas Paqueta|CAM|83|BRA|28
Tomas Soucek|CDM|79|CZE|31
Edson Alvarez|CDM|80|MEX|28
Guido Rodriguez|CDM|77|ARG|32
Andy Irving|CM|72|ENG|25
Divine Mukasa|CM|72|ENG|18
Jarrod Bowen|RW|82|ENG|29
Crysencio Summerville|LW|79|NED|24
Niclas Fullkrug|ST|78|GER|33
Joel Piroe|ST|76|NED|27`),
  C('realmadrid', 'Real Madrid', 'RMA', 'LALIGA', 'Santiago Bernabeu', ['#FFFFFF', '#FEBE10'], ['#FFFFFF', '#FFFFFF', '#00529F'], `
Thibaut Courtois|GK|89|BEL|34
Andriy Lunin|GK|79|UKR|27
Antonio Rudiger|CB|85|GER|33
Dean Huijsen|CB|83|ESP|21
Eder Militao|CB|84|BRA|28
Ibrahima Konate|CB|85|FRA|27
Marc Cucurella|LB|82|ESP|28
Denzel Dumfries|RB|82|NED|30
Jude Bellingham|CAM|91|ENG|23
Federico Valverde|CM|88|URU|27
Aurelien Tchouameni|CDM|85|FRA|26
Eduardo Camavinga|CM|83|FRA|23
Bernardo Silva|CM|86|POR|32
Arda Guler|CAM|83|TUR|21
Kylian Mbappe|ST|94|FRA|27
Vinicius Junior|LW|91|BRA|26
Rodrygo|RW|84|BRA|25
Yan Diomande|RW|82|CIV|19`),
  C('barcelona', 'FC Barcelona', 'BAR', 'LALIGA', 'Spotify Camp Nou', ['#A50044', '#004D98'], ['#A50044', '#004D98', '#FFD54A'], `
Joan Garcia|GK|82|ESP|25
Dominik Livakovic|GK|80|CRO|31
Pau Cubarsi|CB|84|ESP|19
Jules Kounde|RB|85|FRA|27
Alejandro Balde|LB|82|ESP|22
Eric Garcia|CB|78|ESP|25
Gerard Martin|LB|74|ESP|24
Joao Cancelo|RB|82|POR|32
Pedri|CM|89|ESP|23
Frenkie de Jong|CM|86|NED|29
Rodri|CDM|90|ESP|30
Gavi|CM|82|ESP|22
Dani Olmo|CAM|84|ESP|28
Marc Casado|CDM|79|ESP|22
Lamine Yamal|RW|91|ESP|19
Raphinha|LW|87|BRA|29
Anthony Gordon|LW|84|ENG|25
Marcus Rashford|LW|82|ENG|28`),
  C('atletico', 'Atletico Madrid', 'ATM', 'LALIGA', 'Metropolitano', ['#CB3524', '#272E61'], ['#CB3524', '#272E61', '#FFFFFF'], `
Jan Oblak|GK|87|SVN|33
Juan Musso|GK|77|ARG|31
Jose Maria Gimenez|CB|84|URU|31
Cristian Romero|CB|86|ARG|28
Robin Le Normand|CB|82|ESP|29
David Hancko|LB|80|SVK|28
Alejandro Grimaldo|LB|84|ESP|30
Nahuel Molina|RB|79|ARG|28
Koke|CM|80|ESP|34
Pablo Barrios|CM|80|ESP|22
Morten Hjulmand|CDM|82|DEN|27
Conor Gallagher|CM|81|ENG|26
Johnny Cardoso|CDM|79|USA|24
Lee Kang-in|CAM|81|KOR|25
Julian Alvarez|ST|87|ARG|26
Antoine Griezmann|ST|85|FRA|35
Jonathan David|ST|83|CAN|26
Alexander Sorloth|ST|81|NOR|30`),
  C('athletic', 'Athletic Club', 'ATH', 'LALIGA', 'San Mames', ['#EE2523', '#FFFFFF'], ['#EE2523', '#000000', '#FFFFFF'], `
Unai Simon|GK|83|ESP|28
Alex Padilla|GK|72|ESP|25
Dani Vivian|CB|82|ESP|26
Aymeric Laporte|CB|82|ESP|32
Yuri Berchiche|LB|79|ESP|36
Oscar de Marcos|RB|76|ESP|36
Andoni Gorosabel|RB|76|ESP|29
Yeray Alvarez|CB|79|ESP|31
Mikel Jauregizar|CDM|79|ESP|22
Oihan Sancet|CAM|82|ESP|26
Benat Prados|CM|76|ESP|24
Unai Gomez|CM|77|ESP|22
Alejandro Rego|CM|74|ESP|22
Mikel Vesga|CDM|75|ESP|33
Nico Williams|LW|85|ESP|24
Inaki Williams|RW|80|GHA|32
Gorka Guruzeta|ST|79|ESP|29
Alex Berenguer|LW|78|ESP|31`),
  C('realsociedad', 'Real Sociedad', 'RSO', 'LALIGA', 'Anoeta', ['#0067B1', '#FFFFFF'], ['#0067B1', '#FFFFFF', '#FFFFFF'], `
Alex Remiro|GK|80|ESP|31
Unai Marrero|GK|72|ESP|26
Igor Zubeldia|CB|80|ESP|29
Aritz Elustondo|CB|76|ESP|32
Jon Martin|CB|75|ESP|29
Aihen Munoz|LB|75|ESP|28
Jon Aramburu|RB|76|VEN|24
Mamadou Sarr|CB|76|FRA|20
Brais Mendez|CAM|82|ESP|29
Luka Sucic|CM|78|CRO|23
Carlos Soler|CM|78|ESP|29
Jon Gorrotxategi|CDM|76|ESP|24
Benat Turrientes|CDM|75|ESP|24
Arsen Zakharyan|CAM|76|RUS|22
Takefusa Kubo|RW|84|JPN|25
Mikel Oyarzabal|ST|85|ESP|29
Ander Barrenetxea|LW|77|ESP|24
Orri Oskarsson|ST|76|ISL|22`),
  C('inter', 'Inter', 'INT', 'SERIEA', 'San Siro', ['#0068A8', '#000000'], ['#0068A8', '#000000', '#FFFFFF'], `
Yann Sommer|GK|82|SUI|37
Josep Martinez|GK|76|ESP|28
Alessandro Bastoni|CB|87|ITA|27
Manuel Akanji|CB|82|SUI|31
John Stones|CB|82|ENG|32
Federico Dimarco|LB|84|ITA|28
Benjamin Pavard|CB|80|FRA|30
Djed Spence|RB|77|ENG|26
Nicolo Barella|CM|87|ITA|29
Hakan Calhanoglu|CDM|86|TUR|32
Curtis Jones|CM|79|ENG|25
Henrikh Mkhitaryan|CM|80|ARM|37
Piotr Zielinski|CM|82|POL|32
Davide Frattesi|CM|80|ITA|26
Lautaro Martinez|ST|89|ARG|28
Marcus Thuram|ST|85|FRA|28
Ange-Yoan Bonny|ST|76|FRA|22
Francesco Pio Esposito|ST|76|ITA|20`),
  C('napoli', 'Napoli', 'NAP', 'SERIEA', 'Stadio Diego Armando Maradona', ['#12A0D7', '#FFFFFF'], ['#12A0D7', '#FFFFFF', '#FFFFFF'], `
Alex Meret|GK|80|ITA|29
Vanja Milinkovic-Savic|GK|78|SRB|29
Alessandro Buongiorno|CB|83|ITA|27
Amir Rrahmani|CB|81|ALB|32
Giovanni Di Lorenzo|RB|80|ITA|33
Benoit Badiashile|CB|78|FRA|25
Sam Beukema|CB|80|NED|27
Mathias Olivera|LB|78|URU|28
Scott McTominay|CM|86|SCO|29
Kevin De Bruyne|CAM|87|BEL|35
Stanislav Lobotka|CDM|83|SVK|31
Billy Gilmour|CM|78|SCO|25
Frank Anguissa|CM|82|CMR|30
Giacomo Raspadori|CAM|76|ITA|26
Rasmus Hojlund|ST|80|DEN|23
Romelu Lukaku|ST|82|BEL|33
David Neres|RW|80|BRA|29
Noa Lang|LW|80|NED|27`),
  C('juventus', 'Juventus', 'JUV', 'SERIEA', 'Allianz Stadium', ['#111111', '#FFFFFF'], ['#FFFFFF', '#111111', '#111111'], `
Mattia Perin|GK|76|ITA|33
Kamil Grabara|GK|76|POL|27
Gleison Bremer|CB|85|BRA|29
Pierre Kalulu|CB|79|FRA|26
Federico Gatti|CB|79|ITA|27
Andrea Cambiaso|LB|81|ITA|26
Juan Cabal|RB|77|COL|25
Lloyd Kelly|LB|77|ENG|27
Manuel Locatelli|CDM|81|ITA|28
Khephren Thuram|CM|82|FRA|25
Weston McKennie|CM|80|USA|27
Teun Koopmeiners|CM|82|NED|28
Kenan Yildiz|CAM|85|TUR|21
Pape Matar Sarr|CM|80|SEN|23
Dusan Vlahovic|ST|82|SRB|26
Randal Kolo Muani|ST|82|FRA|27
Nick Woltemade|ST|82|GER|24
Francisco Conceicao|RW|82|POR|23`),
  C('atalanta', 'Atalanta', 'ATA', 'SERIEA', 'Gewiss Stadium', ['#1E71B8', '#000000'], ['#1E71B8', '#000000', '#FFFFFF'], `
Marco Carnesecchi|GK|80|ITA|26
Marco Sportiello|GK|74|ITA|34
Isak Hien|CB|80|SWE|27
Berat Djimsiti|CB|79|ALB|33
Sead Kolasinac|LB|76|BIH|33
Odilon Kossounou|CB|79|CIV|25
Raoul Bellanova|RB|79|ITA|26
Davide Zappacosta|RB|77|ITA|33
Ederson|CM|83|BRA|26
Marten de Roon|CDM|78|NED|35
Lazar Samardzic|CM|80|SRB|24
Mario Pasalic|CM|78|CRO|31
Charles De Ketelaere|CAM|82|BEL|25
Marco Brescianini|CM|77|ITA|25
Ademola Lookman|LW|85|NGA|28
Gianluca Scamacca|ST|80|ITA|27
Nikola Krstovic|ST|78|MNE|26
Kamaldeen Sulemana|LW|77|GHA|24`),
  C('acmilan', 'AC Milan', 'MIL', 'SERIEA', 'San Siro', ['#FB090B', '#000000'], ['#FB090B', '#000000', '#FFFFFF'], `
Mike Maignan|GK|87|FRA|30
Pietro Terracciano|GK|75|ITA|35
Fikayo Tomori|CB|83|ENG|28
Strahinja Pavlovic|CB|81|SRB|24
Matteo Gabbia|CB|77|ITA|26
Alexis Saelemaekers|RB|78|BEL|26
Davide Bartesaghi|LB|74|ITA|20
Koni De Winter|CB|76|BEL|24
Luka Modric|CM|82|CRO|40
Adrien Rabiot|CM|84|FRA|31
Youssouf Fofana|CDM|80|FRA|27
Ardon Jashari|CDM|79|SUI|24
Christian Pulisic|CAM|84|USA|27
Samuele Ricci|CDM|79|ITA|24
Rafael Leao|LW|86|POR|27
Goncalo Ramos|ST|83|POR|25
Santiago Gimenez|ST|80|MEX|25
Christopher Nkunku|ST|82|FRA|28`),
  C('bayern', 'Bayern Munich', 'BAY', 'BUNDES', 'Allianz Arena', ['#DC052D', '#FFFFFF'], ['#DC052D', '#FFFFFF', '#FFFFFF'], `
Manuel Neuer|GK|85|GER|40
Jonas Urbig|GK|76|GER|22
Dayot Upamecano|CB|85|FRA|27
Jonathan Tah|CB|84|GER|30
Alphonso Davies|LB|84|CAN|25
Josip Stanisic|RB|79|CRO|26
Min-jae Kim|CB|82|KOR|29
Hiroki Ito|CB|78|JPN|27
Joshua Kimmich|CDM|89|GER|31
Jamal Musiala|CAM|90|GER|23
Aleksandar Pavlovic|CM|82|GER|22
Raphael Guerreiro|CM|80|POR|32
Tom Bischof|CM|75|GER|20
Konrad Laimer|CM|80|AUT|29
Harry Kane|ST|92|ENG|33
Michael Olise|RW|88|FRA|24
Luis Diaz|LW|86|COL|29
Serge Gnabry|RW|82|GER|31`),
  C('dortmund', 'Borussia Dortmund', 'BVB', 'BUNDES', 'Signal Iduna Park', ['#FDE100', '#000000'], ['#FDE100', '#000000', '#000000'], `
Gregor Kobel|GK|86|SUI|28
Alexander Meyer|GK|74|GER|35
Nico Schlotterbeck|CB|85|GER|26
Waldemar Anton|CB|82|GER|29
Ramy Bensebaini|LB|80|ALG|31
Julian Ryerson|RB|79|NOR|28
Niklas Sule|CB|81|GER|30
Daniel Svensson|LB|77|SWE|24
Felix Nmecha|CM|81|GER|25
Pascal Gross|CM|79|GER|35
Marcel Sabitzer|CM|80|AUT|32
Julian Brandt|CAM|83|GER|30
Jobe Bellingham|CM|79|ENG|20
Ethan Nwaneri|CAM|78|ENG|19
Serhou Guirassy|ST|86|GUI|30
Maximilian Beier|ST|80|GER|23
Fabio Silva|ST|77|POR|24
Carney Chukwuemeka|CAM|75|ENG|22`),
  C('leverkusen', 'Bayer Leverkusen', 'LEV', 'BUNDES', 'BayArena', ['#E32221', '#000000'], ['#E32221', '#000000', '#FFFFFF'], `
Mark Flekken|GK|79|NED|32
Janis Blaswich|GK|74|GER|35
Jarell Quansah|CB|79|ENG|23
Edmond Tapsoba|CB|82|BFA|27
Loic Bade|CB|77|FRA|25
Lucas Vazquez|RB|79|ESP|34
Jeanuel Belocian|LB|77|FRA|20
Robert Andrich|CDM|80|GER|31
Aleix Garcia|CM|80|ESP|28
Ibrahim Maza|CAM|78|ALG|20
Jonas Hofmann|CAM|80|GER|33
Malik Tillman|CAM|79|USA|23
Patrik Schick|ST|84|CZE|30
Eliesse Ben Seghir|RW|79|MAR|21
Nathan Tella|RW|77|NGA|27
Christian Kofane|ST|76|CMR|19`),
];

export const CLUB_BY_KEY = Object.fromEntries(CLUBS.map((c) => [c.key, c]));

export const SIGNUP_CLUBS = {
  EPL: ['mancity', 'arsenal', 'liverpool', 'chelsea', 'manutd', 'tottenham', 'newcastle', 'astonvilla', 'brighton', 'westham'],
  LALIGA: ['realmadrid', 'barcelona', 'atletico', 'athletic', 'realsociedad'],
  SERIEA: ['inter', 'napoli', 'juventus', 'atalanta', 'acmilan'],
  BUNDES: ['bayern', 'dortmund', 'leverkusen'],
};
