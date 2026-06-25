CREATE TABLE `testInvitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quizId` int NOT NULL,
	`studentEmail` varchar(320) NOT NULL,
	`studentId` int,
	`status` enum('pending','accepted','completed','expired') NOT NULL DEFAULT 'pending',
	`invitedAt` timestamp NOT NULL DEFAULT (now()),
	`acceptedAt` timestamp,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `testInvitations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `testSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quizId` int NOT NULL,
	`userId` int NOT NULL,
	`invitationId` int,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`completedAt` timestamp,
	`isCompleted` boolean NOT NULL DEFAULT false,
	`score` decimal(5,2),
	`totalQuestions` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `testSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `quizzes` ADD `quizType` enum('personal','test') DEFAULT 'personal' NOT NULL;--> statement-breakpoint
ALTER TABLE `quizzes` ADD `durationMinutes` int;