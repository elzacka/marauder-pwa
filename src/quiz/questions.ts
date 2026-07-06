/** Offline HP quiz bank (English, canon terms). Options index 0 is always
 *  the correct answer — the quiz shuffles before display. */
export type QuizQuestion = { q: string; options: [string, string, string, string] }

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  { q: 'Which platform does the Hogwarts Express leave from?', options: ['9¾', '7½', '10¼', '6⅔'] },
  { q: 'What is the name of Harry’s owl?', options: ['Hedwig', 'Errol', 'Pigwidgeon', 'Hermes'] },
  { q: 'Which house does Luna Lovegood belong to?', options: ['Ravenclaw', 'Gryffindor', 'Hufflepuff', 'Slytherin'] },
  { q: 'What is Lord Voldemort’s real name?', options: ['Tom Riddle', 'Marvolo Gaunt', 'Regulus Black', 'Barty Crouch'] },
  { q: 'Which spell disarms an opponent?', options: ['Expelliarmus', 'Expecto Patronum', 'Alohomora', 'Stupefy'] },
  { q: 'What is the name of Hagrid’s three-headed dog?', options: ['Fluffy', 'Fang', 'Norbert', 'Buckbeak'] },
  { q: 'Who is the Half-Blood Prince?', options: ['Severus Snape', 'Draco Malfoy', 'Sirius Black', 'Remus Lupin'] },
  { q: 'What form does Harry’s Patronus take?', options: ['A stag', 'An otter', 'A dog', 'A doe'] },
  { q: 'What is the wizarding bank in Diagon Alley called?', options: ['Gringotts', 'Borgin and Burkes', 'Ollivanders', 'Flourish and Blotts'] },
  { q: 'How many Horcruxes did Voldemort make on purpose?', options: ['Six', 'Five', 'Seven', 'Eight'] },
  { q: 'What does the Seeker catch in Quidditch?', options: ['The Golden Snitch', 'The Quaffle', 'The Bludger', 'The Beater'] },
  { q: 'Who kills Albus Dumbledore?', options: ['Severus Snape', 'Draco Malfoy', 'Bellatrix Lestrange', 'Voldemort'] },
  { q: 'What is the name of the Malfoy family’s house-elf?', options: ['Dobby', 'Kreacher', 'Winky', 'Hokey'] },
  { q: 'Which subject does Professor McGonagall teach?', options: ['Transfiguration', 'Potions', 'Divination', 'Herbology'] },
  { q: 'What is written on the Mirror of Erised?', options: ['Erised stra ehru oyt ube cafru oyt on wohsi', 'Draco dormiens nunquam titillandus', 'Nitwit! Blubber! Oddment! Tweak!', 'I must not tell lies'] },
  { q: 'Who gives Harry the Invisibility Cloak?', options: ['Dumbledore', 'Hagrid', 'Sirius Black', 'Mundungus Fletcher'] },
  { q: 'Which dragon does Harry face in the Triwizard Tournament?', options: ['Hungarian Horntail', 'Common Welsh Green', 'Norwegian Ridgeback', 'Swedish Short-Snout'] },
  { q: 'What is the name of Ron’s rat?', options: ['Scabbers', 'Crookshanks', 'Errol', 'Wormy'] },
  { q: 'Where is the headquarters of the Order of the Phoenix?', options: ['Number 12, Grimmauld Place', 'Diagon Alley 93', 'Number 4, Privet Drive', 'Spinner’s End'] },
  { q: 'What does Mad-Eye Moody turn Draco Malfoy into in Goblet of Fire?', options: ['A ferret', 'A frog', 'A rat', 'A badger'] },
  { q: 'Whose diary opens the Chamber of Secrets?', options: ['Tom Riddle’s', 'Ginny Weasley’s', 'Salazar Slytherin’s', 'Lucius Malfoy’s'] },
  { q: 'Which potion lets you take another person’s appearance?', options: ['Polyjuice Potion', 'Veritaserum', 'Felix Felicis', 'Amortentia'] },
  { q: 'Who is buried at Shell Cottage?', options: ['Dobby', 'Mad-Eye Moody', 'Hedwig', 'Fred Weasley'] },
  { q: 'In which Edinburgh café did J.K. Rowling famously write?', options: ['The Elephant House', 'The Owl Nest', 'Greyfriars Café', 'The Quill & Ink'] },
]
