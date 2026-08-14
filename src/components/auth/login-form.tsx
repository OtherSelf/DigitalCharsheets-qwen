'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/firebase';
import {
  initiateEmailPasswordSignIn,
  initiateGoogleSignIn,
} from '@/firebase/non-blocking-login';
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader } from '../loader';
import { useState } from 'react';

const formSchema = z.object({
  username: z.string().min(1, { message: 'Username is required.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

export function LoginForm() {
  const auth = useAuth();
  const { toast } = useToast();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (auth) {
      const email = `${values.username}@verse-scribe.app`;
      initiateEmailPasswordSignIn(
        auth,
        email,
        values.password,
        (error) => {
          toast({
            variant: 'destructive',
            title: 'Sign In Failed',
            description:
              error.code === 'auth/invalid-credential'
                ? 'Invalid username or password.'
                : error.message,
          });
        }
      );
    }
  }

  function onGoogleSignIn() {
    if (auth) {
      setIsGoogleLoading(true);
      initiateGoogleSignIn(
        auth,
        () => setIsGoogleLoading(false),
        (error) => {
          setIsGoogleLoading(false);
          if (error.code !== 'auth/popup-closed-by-user') {
            toast({
              variant: 'destructive',
              title: 'Google Sign-In Failed',
              description: 'Could not sign in with Google. Please try again.',
            });
          }
        }
      );
    }
  }

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input
                    placeholder="your-username"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full">
            Sign In
          </Button>
        </form>
      </Form>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>
      <Button 
        variant="outline" 
        className="w-full" 
        onClick={onGoogleSignIn}
        disabled={isGoogleLoading}
      >
        {isGoogleLoading ? <Loader className="mr-2 h-4 w-4" /> : null}
        Google
      </Button>
    </div>
  );
}
