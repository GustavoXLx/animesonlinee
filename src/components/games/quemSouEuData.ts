// Temas do "Quem sou eu?". Formato: "Nome exibido" ou "Nome exibido|Título na Wikipédia (en)".
export type QTheme = { id: string; name: string; desc: string; pool?: string[] };

const L = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export const THEMES: QTheme[] = [
  { id: "rostos", name: "Rostos", desc: "pessoas desenhadas, nunca repetem" },
  {
    id: "famosos",
    name: "Famosos",
    desc: "cantores, atores e celebridades",
    pool: L(`Anitta|Anitta (singer)
Neymar
Taylor Swift
Beyoncé
Rihanna
Justin Bieber
Ariana Grande
Lady Gaga
Shakira
Bruno Mars
Ed Sheeran
Billie Eilish
Dua Lipa
The Weeknd
Drake|Drake (musician)
Eminem
Selena Gomez
Miley Cyrus
Katy Perry
Harry Styles
Zendaya
Tom Holland
Leonardo DiCaprio
Brad Pitt
Angelina Jolie
Johnny Depp
Will Smith
Dwayne Johnson
Keanu Reeves
Margot Robbie
Scarlett Johansson
Robert Downey Jr.
Chris Hemsworth
Ryan Reynolds
Jennifer Aniston
Jennifer Lopez
Kim Kardashian
Kylie Jenner
Oprah Winfrey
Elon Musk
Mark Zuckerberg
Bill Gates
Steve Jobs
Michael Jackson
Madonna
Freddie Mercury
Elvis Presley
Marilyn Monroe
Ivete Sangalo
Xuxa
Silvio Santos
Faustão|Fausto Silva
Gisele Bündchen
Luan Santana
Marília Mendonça
Ludmilla|Ludmilla (singer)
Pabllo Vittar
Wesley Safadão
Gusttavo Lima
Jorge Ben Jor
Roberto Carlos|Roberto Carlos (singer)
Rodrigo Santoro
Wagner Moura
Fernanda Montenegro
Sabrina Carpenter
Olivia Rodrigo
Bad Bunny
Post Malone
Travis Scott
Snoop Dogg
Adele
Lana Del Rey
Pedro Pascal
Timothée Chalamet
Jenna Ortega
Millie Bobby Brown
Emma Watson
Daniel Radcliffe
Tom Cruise
Morgan Freeman
Denzel Washington
Johnny Bravo|Johnny Bravo`),
  },
  {
    id: "jogadores",
    name: "Jogadores",
    desc: "craques do futebol",
    pool: L(`Neymar
Lionel Messi
Cristiano Ronaldo
Kylian Mbappé
Erling Haaland
Vinícius Júnior
Rodrygo|Rodrygo (footballer, born 2001)
Kevin De Bruyne
Mohamed Salah
Luka Modrić
Karim Benzema
Robert Lewandowski
Harry Kane
Jude Bellingham
Pedri
Lamine Yamal
Antoine Griezmann
Ronaldinho
Ronaldo|Ronaldo (Brazilian footballer)
Kaká
Pelé
Romário
Rivaldo
Roberto Carlos|Roberto Carlos (footballer)
Cafu
Zico
Garrincha
Diego Maradona
Zinedine Zidane
Thierry Henry
David Beckham
Andrea Pirlo
Francesco Totti
Paolo Maldini
Gianluigi Buffon
Iker Casillas
Manuel Neuer
Alisson Becker
Ederson|Ederson (footballer, born 1993)
Thiago Silva
Marquinhos
Casemiro
Gabriel Jesus
Richarlison
Raphinha
Endrick|Endrick (footballer)
Gabriel Barbosa
Arrascaeta|Giorgian de Arrascaeta
Hulk|Hulk (footballer)
Philippe Coutinho
Dani Alves
Marcelo|Marcelo (footballer, born 1988)
Sergio Ramos
Virgil van Dijk
Luis Suárez
Edinson Cavani
Zlatan Ibrahimović
Wayne Rooney
Steven Gerrard
Frank Lampard
Xavi
Andrés Iniesta
Sergio Busquets
Gareth Bale
Eden Hazard
Son Heung-min
Bukayo Saka
Phil Foden
Florian Wirtz
Jamal Musiala
Martin Ødegaard
Bruno Fernandes
Rúben Dias
Cole Palmer
Rafael Leão
Victor Osimhen
Lautaro Martínez
Julián Álvarez
Emiliano Martínez
Ángel Di María
Sergio Agüero
Rogério Ceni
Marta|Marta (footballer)
Alexia Putellas`),
  },
  {
    id: "filmes",
    name: "Filmes",
    desc: "filmes famosos",
    pool: L(`Titanic|Titanic (1997 film)
Avatar|Avatar (2009 film)
Vingadores: Ultimato|Avengers: Endgame
Homem-Aranha: Sem Volta pra Casa|Spider-Man: No Way Home
O Rei Leão|The Lion King
Frozen|Frozen (2013 film)
Toy Story
Procurando Nemo|Finding Nemo
Shrek
Divertida Mente|Inside Out (2015 film)
Up: Altas Aventuras|Up (2009 film)
Carros|Cars (film)
Os Incríveis|The Incredibles
Ratatouille|Ratatouille (film)
Wall-E|WALL-E
Coco|Coco (2017 film)
Moana|Moana (2016 film)
Encanto|Encanto (film)
Enrolados|Tangled
A Viagem de Chihiro|Spirited Away
Meu Amigo Totoro|My Neighbor Totoro
Your Name|Your Name
Harry Potter e a Pedra Filosofal|Harry Potter and the Philosopher's Stone (film)
O Senhor dos Anéis|The Lord of the Rings: The Fellowship of the Ring
Star Wars|Star Wars (film)
Jurassic Park|Jurassic Park (film)
De Volta para o Futuro|Back to the Future
Matrix|The Matrix
O Poderoso Chefão|The Godfather
Pulp Fiction
Forrest Gump
Clube da Luta|Fight Club
Interestelar|Interstellar (film)
A Origem|Inception
Batman: O Cavaleiro das Trevas|The Dark Knight
Coringa|Joker (2019 film)
Barbie|Barbie (film)
Oppenheimer|Oppenheimer (film)
Duna|Dune (2021 film)
Pantera Negra|Black Panther (film)
Homem de Ferro|Iron Man (2008 film)
Thor|Thor (film)
Capitão América|Captain America: The First Avenger
Guardiões da Galáxia|Guardians of the Galaxy (film)
Deadpool|Deadpool (film)
Velozes e Furiosos|The Fast and the Furious (2001 film)
Missão Impossível|Mission: Impossible (film)
Piratas do Caribe|Pirates of the Caribbean: The Curse of the Black Pearl
Esqueceram de Mim|Home Alone
Gente Grande|Grown Ups (film)
Cidade de Deus|City of God (2002 film)
Tropa de Elite|Elite Squad
Central do Brasil
Ainda Estou Aqui|I'm Still Here (2024 film)
O Auto da Compadecida|A Dog's Will
Minha Mãe é uma Peça|My Mom Is a Character
Parasita|Parasite (2019 film)
Diário de uma Paixão|The Notebook
Como Eu Era Antes de Você|Me Before You (film)
A Culpa é das Estrelas|The Fault in Our Stars (film)
Crepúsculo|Twilight (2008 film)
Jogos Vorazes|The Hunger Games (film)
Mulher-Maravilha|Wonder Woman (2017 film)
It: A Coisa|It (2017 film)
Invocação do Mal|The Conjuring
Pânico|Scream (1996 film)
O Exorcista|The Exorcist
Gladiador|Gladiator (2000 film)
Top Gun: Maverick
Mad Max: Estrada da Fúria|Mad Max: Fury Road
La La Land
Grease|Grease (film)
Mamma Mia!|Mamma Mia! (film)
Meninas Malvadas|Mean Girls
Kung Fu Panda
Madagascar|Madagascar (2005 film)
A Era do Gelo|Ice Age (2002 film)
Meu Malvado Favorito|Despicable Me
Minions|Minions (film)
Zootopia
Como Treinar o seu Dragão|How to Train Your Dragon (2010 film)
Aladdin|Aladdin (1992 Disney film)
A Bela e a Fera|Beauty and the Beast (1991 film)
A Pequena Sereia|The Little Mermaid (1989 film)
Super Mario Bros. O Filme|The Super Mario Bros. Movie
Wicked|Wicked (2024 film)
Divertida Mente 2|Inside Out 2`),
  },
  {
    id: "carros",
    name: "Carros",
    desc: "modelos de carro",
    pool: L(`Fusca|Volkswagen Beetle
Gol|Volkswagen Gol
Golf|Volkswagen Golf
Polo|Volkswagen Polo
Kombi|Volkswagen Type 2
Amarok|Volkswagen Amarok
Uno|Fiat Uno
Palio|Fiat Palio
Strada|Fiat Strada
Toro|Fiat Toro
Fiat 500
Celta|Chevrolet Celta
Onix|Chevrolet Onix
Opala|Chevrolet Opala
Camaro|Chevrolet Camaro
Corvette|Chevrolet Corvette
S10|Chevrolet S-10 (Brazil)
Ka|Ford Ka
Fiesta|Ford Fiesta
Mustang|Ford Mustang
Ranger|Ford Ranger
Ford F-150|Ford F-Series
Corolla|Toyota Corolla
Hilux|Toyota Hilux
Supra|Toyota Supra
Prius|Toyota Prius
Civic|Honda Civic
HR-V|Honda HR-V
Fit|Honda Fit
Hyundai HB20
Creta|Hyundai Creta
Renault Kwid
Sandero|Dacia Sandero
Renault Clio
Nissan GT-R
Nissan Kicks
Mitsubishi Lancer Evolution
Mitsubishi Pajero
Subaru Impreza WRX|Subaru WRX
Mazda MX-5
Jeep Wrangler
Jeep Renegade
Jeep Compass
Tesla Model S
Tesla Model 3
Tesla Cybertruck
BMW M3
BMW X5
BMW i8
Mercedes Classe G|Mercedes-Benz G-Class
Mercedes Classe A|Mercedes-Benz A-Class
Audi R8
Audi A3
Audi TT
Porsche 911
Porsche Cayenne
Ferrari F40
Ferrari LaFerrari|LaFerrari
Ferrari 488
Lamborghini Aventador
Lamborghini Huracán
Lamborghini Urus
Lamborghini Countach
Bugatti Veyron
Bugatti Chiron
McLaren P1
McLaren F1
Aston Martin DB5
Rolls-Royce Phantom|Rolls-Royce Phantom (2003)
Bentley Continental GT
Mini Cooper|Mini (marque)
Range Rover
Land Rover Defender
Volvo XC90
Dodge Challenger
Dodge Charger|Dodge Charger (2005)
DeLorean|DeLorean DMC-12
Kia Sportage
BYD Dolphin
Chevrolet Chevette
Fiat 147
Volkswagen Brasília
Volkswagen Santana
Ford Escort|Ford Escort (Europe)
Toyota Bandeirante
Gurgel|Gurgel BR-800`),
  },
  {
    id: "animes",
    name: "Personagens de anime",
    desc: "a cara do AniStream",
    pool: L(`Naruto Uzumaki
Sasuke Uchiha
Kakashi Hatake
Itachi Uchiha
Hinata Hyuga
Sakura Haruno
Goku|Goku
Vegeta
Gohan
Piccolo|Piccolo (Dragon Ball)
Bulma
Monkey D. Luffy
Roronoa Zoro
Nami|Nami (One Piece)
Sanji|Sanji (One Piece)
Tony Tony Chopper
Ichigo Kurosaki
Eren Yeager
Mikasa Ackerman
Levi|Levi Ackerman
Light Yagami
L|L (Death Note)
Edward Elric
Tanjiro Kamado
Nezuko Kamado
Zenitsu Agatsuma
Inosuke Hashibira
Satoru Gojo
Yuji Itadori
Megumi Fushiguro
Izuku Midoriya
Katsuki Bakugo
Shoto Todoroki
All Might
Gon Freecss
Killua Zoldyck
Saitama|Saitama (One-Punch Man)
Ash Ketchum
Pikachu
Sailor Moon|Usagi Tsukino
Seiya|Pegasus Seiya
Inuyasha|Inuyasha (character)
Kenshin Himura
Spike Spiegel
Denji|Denji (Chainsaw Man)
Power|Power (Chainsaw Man)
Makima
Anya Forger
Loid Forger
Yor Forger
Frieren|Frieren (character)
Shinji Ikari
Rei Ayanami
Asuka Langley Soryu
Lelouch Lamperouge
Kirito|Kirito (Sword Art Online)
Rem|Rem (Re:Zero)
Hatsune Miku
Doraemon|Doraemon (character)
Totoro
Sung Jinwoo
Ken Kaneki
Yugi Muto
Kenpachi Zaraki
Rukia Kuchiki
Hisoka|Hisoka Morow
Boa Hancock
Portgas D. Ace
Trafalgar Law
Shanks|Shanks (One Piece)
Jiraiya|Jiraiya (Naruto)
Gaara
Madara Uchiha
Rock Lee
Majin Buu
Frieza
Trunks|Trunks (Dragon Ball)
Mob|Shigeo Kageyama
Thorfinn|Thorfinn (Vinland Saga)
Guts|Guts (Berserk)
Hinata Shoyo|Shoyo Hinata`),
  },
  {
    id: "animais",
    name: "Animais",
    desc: "bichos do mundo todo",
    pool: L(`Leão|Lion
Tigre|Tiger
Onça-pintada|Jaguar
Leopardo|Leopard
Guepardo|Cheetah
Elefante|African bush elephant
Girafa|Giraffe
Zebra|Plains zebra
Hipopótamo|Hippopotamus
Rinoceronte|White rhinoceros
Gorila|Gorilla
Chimpanzé|Chimpanzee
Orangotango|Orangutan
Panda|Giant panda
Urso-polar|Polar bear
Coala|Koala
Canguru|Red kangaroo
Preguiça|Sloth
Tamanduá|Giant anteater
Capivara|Capybara
Tatu|Nine-banded armadillo
Lobo|Wolf
Raposa|Red fox
Guaxinim|Raccoon
Esquilo|Red squirrel
Coelho|European rabbit
Hamster|Golden hamster
Porquinho-da-índia|Guinea pig
Ouriço|Hedgehog
Morcego|Bat
Golfinho|Common bottlenose dolphin
Baleia-azul|Blue whale
Orca|Orca
Tubarão-branco|Great white shark
Polvo|Octopus
Água-viva|Jellyfish
Cavalo-marinho|Seahorse
Tartaruga-marinha|Sea turtle
Pinguim|Emperor penguin
Foca|Harbor seal
Flamingo|American flamingo
Tucano|Toco toucan
Arara-azul|Hyacinth macaw
Papagaio|Parrot
Coruja|Barn owl
Águia|Bald eagle
Pavão|Indian peafowl
Beija-flor|Hummingbird
Avestruz|Common ostrich
Galinha|Chicken
Pato|Mallard
Cisne|Mute swan
Jacaré|Yacare caiman
Crocodilo|Nile crocodile
Camaleão|Chameleon
Iguana|Green iguana
Cobra-coral|Coral snake
Sapo|Common toad
Borboleta|Monarch butterfly
Abelha|Western honey bee
Joaninha|Coccinellidae
Formiga|Ant
Camelo|Dromedary
Lhama|Llama
Alpaca
Vaca|Cattle
Porco|Domestic pig
Ovelha|Sheep
Cabra|Goat
Cavalo|Horse
Burro|Donkey
Gato|Cat
Cachorro|Dog
Panda-vermelho|Red panda
Lontra|Sea otter
Castor|North American beaver
Mico-leão-dourado|Golden lion tamarin
Lêmure|Ring-tailed lemur
Ornitorrinco|Platypus
Axolote|Axolotl`),
  },
  {
    id: "comidas",
    name: "Comidas",
    desc: "pratos e lanches",
    pool: L(`Pizza
Hambúrguer|Hamburger
Cachorro-quente|Hot dog
Sushi
Lasanha|Lasagna
Espaguete|Spaghetti
Feijoada
Coxinha
Pão de queijo
Brigadeiro
Açaí|Açaí na tigela
Pastel|Pastel (Brazilian food)
Tapioca|Tapioca
Moqueca
Acarajé
Churrasco|Churrasco
Picanha
Farofa
Pudim|Flan
Paçoca
Quindim
Beijinho|Beijinho (sweet)
Bolo de cenoura|Carrot cake
Taco|Taco
Burrito
Nachos
Ramen
Lámen instantâneo|Instant noodles
Yakisoba
Temaki|Temaki
Dim sum
Curry
Kebab
Falafel
Croissant
Baguete|Baguette
Waffle
Panqueca|Pancake
Donut|Doughnut
Churros|Churro
Sorvete|Ice cream
Chocolate
Macarons|Macaron
Cheesecake
Brownie|Chocolate brownie
Tiramisu
Petit gâteau|Chocolate lava cake
Batata frita|French fries
Onion rings
Nuggets|Chicken nugget
Frango frito|Fried chicken
Omelete|Omelette
Ovo frito|Fried egg
Salada Caesar|Caesar salad
Risoto|Risotto
Paella
Fondue
Hot pot
Bibimbap
Kimchi
Pipoca|Popcorn
Pão francês|Pão francês
Misto quente|Ham and cheese sandwich
Mortadela|Mortadella
Empada|Empanada
Esfirra|Sfiha
Kibe|Kibbeh
Escondidinho
Cuscuz|Couscous
Polenta
Nhoque|Gnocchi
Ravioli
Canelone|Cannelloni
Strogonoff|Beef Stroganoff
Bobó de camarão|Bobó de camarão
Arroz e feijão|Rice and beans
Banana split
Milkshake
Caldo de cana|Sugarcane juice
Guaraná|Guaraná Antarctica
Café|Coffee`),
  },
];

// ---------- rostos procedurais (combinações praticamente infinitas) ----------
export const FACE_NAMES = L(`Ana
Bruno
Carla
Diego
Elisa
Felipe
Gabi
Heitor
Isis
João
Kaio
Lara
Mateus
Nina
Otávio
Paula
Rafael
Sofia
Tiago
Úrsula
Vitor
Wanda
Yasmin
Zeca
Alice
Bento
Cecília
Davi
Enzo
Flora
Gael
Helena
Igor
Júlia
Luan
Manu
Noah
Olívia
Pedro
Rita
Samuel
Tânia
Vicente
Bia
Caio
Duda
Eduardo
Fábio
Giovana
Hugo
Iara
Jonas
Kátia
Léo
Marina
Nelson
Odete
Pietra
Raul
Sara
Theo
Valéria
Arthur
Beatriz
Cauã
Dora
Emanuel
Fernanda
Gustavo
Heloísa
Ivan
Joana
Lucas
Melissa
Nicolas
Priscila
Renato
Sabrina
Talita
Vanessa
Wagner
Yuri
Zuleica
Alan
Bárbara
César
Débora
Érico
Fabiana
Gilberto
Hilda
Ícaro
Jéssica
Kevin
Lorena
Murilo
Natália
Otto
Patrícia
Rodrigo
Sílvia
Tomás
Vera
Wesley
Amanda
Benício
Clara
Danilo
Estela
Francisco
Glória
Henrique
Inês
Jorge
Lívia
Marcelo
Nádia
Orlando
Paulo
Regina
Sérgio
Teresa
Valentina
Wilson
Aurora
Bernardo
Cristina
Douglas
Eva
Fred
Gisele
Hélio
Irene
Juliano
Larissa
Miguel
Noemi
Oscar
Pâmela
Rubens
Simone
Túlio
Vinícius`);
