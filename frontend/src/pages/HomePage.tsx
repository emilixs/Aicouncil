import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Users, MessageSquare } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-4xl font-bold mb-4">Welcome to AI Council</h1>
      <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
        Create expert councils with specialized AI agents to collaboratively solve complex problems
        through structured discussions and consensus-building.
      </p>
      <div className="flex gap-4">
        <Button asChild size="lg">
          <Link to="/experts">
            <Users className="mr-2 h-5 w-5" />
            Manage Experts
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link to="/sessions">
            <MessageSquare className="mr-2 h-5 w-5" />
            Start Discussion
          </Link>
        </Button>
      </div>
    </div>
  );
}

